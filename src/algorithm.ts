import { BigNumber } from 'ethers';
import _ from 'lodash';
import { Queue } from 'mnemonist';
import { baseTokensByChain, WETH9 } from './base_token';
import {
  Pool,
  Route,
  RouteWithValidQuote,
  Token,
  TokenAmount,
} from './entities';
import { logger } from './logging';
import { IPoolProvider, PoolAccessor } from './pool_provider';
import { ISubgraphPoolProvider } from './subgraph_provider';
import { ITokenProvider } from './token_provider';
import {
  ChainId,
  RoutingConfig,
  SubgraphPool,
  SwapRoute,
  TradeType,
} from './types';

// handle dust in the end of algorithm to make sure the sum of amounts equals to 100%
const getAmountDistribution = (
  amount: TokenAmount,
  distributionPercent: number
): [number[], TokenAmount[]] => {
  const percents = [];
  const amounts = [];
  for (let i = 1; i < 100 / distributionPercent; ++i) {
    percents.push(i * distributionPercent);
    amounts.push(
      amount.multiply(BigNumber.from((i * distributionPercent) / 100))
    );
  }
  return [percents, amounts];
};

// find all route path that can be used to trade from tokenIn to tokenOut
export function computeAllRoutes(
  tokenIn: Token,
  tokenOut: Token,
  pools: Pool[],
  maxHops: number
): Route[] {
  const routes: Route[] = [];
  const poolsUsed: boolean[] = Array<boolean>(pools.length).fill(false);

  const computeRoutes = (
    tokenIn: Token,
    tokenOut: Token,
    currentRoute: Pool[],
    previousTokenOut: Token
  ) => {
    // check if it succeeds
    if (currentRoute.length > maxHops) {
      return;
    }

    if (
      currentRoute.length > 0 &&
      currentRoute[currentRoute.length - 1].involvesToken(tokenOut)
    ) {
      routes.push(new Route([...currentRoute], tokenIn, tokenOut));
    }
    for (let i = 0; i < pools.length; ++i) {
      // return earily
      if (poolsUsed[i]) {
        continue;
      }
      const curPool = pools[i];

      if (!curPool.involvesToken(previousTokenOut)) {
        continue;
      }

      const currentTokenOut = curPool.token0.equals(previousTokenOut)
        ? curPool.token1
        : curPool.token0;

      poolsUsed[i] = true;
      currentRoute.push(curPool);
      computeRoutes(tokenIn, tokenOut, currentRoute, currentTokenOut);
      // rollback
      poolsUsed[i] = false;
      currentRoute.pop();
    }
  };

  computeRoutes(tokenIn, tokenOut, [], tokenIn);

  logger.info(routes, `Computed ${routes.length} possible routes.`);
  return routes;
}

export type GetCandidatePoolsParams = {
  tokenIn: Token;
  tokenOut: Token;
  tradeType: TradeType;
  routingConfig: RoutingConfig;
  subgraphPoolProvider: ISubgraphPoolProvider;
  tokenProvider: ITokenProvider;
  poolProvider: IPoolProvider;
  chainId: ChainId;
};

// filter out unless pools
export async function getCandidatePools({
  tokenIn,
  tokenOut,
  tradeType,
  routingConfig,
  subgraphPoolProvider,
  tokenProvider,
  poolProvider,
  chainId,
}: GetCandidatePoolsParams): Promise<{ poolAccessor: PoolAccessor }> {
  const {
    blockNumber,
    poolSelections: {
      topN,
      topNSecondHop,
      topNWithBaseToken,
      topNTokenInOut,
      topNWithEachBaseToken,
      topNWithBaseTokenInSet,
    },
  } = routingConfig;
  // fetch pools from subgraph or ifps(static file)
  const allPoolsRaw = await subgraphPoolProvider.getPools(tokenIn, tokenOut, {
    blockNumber,
  });

  // sort by reserve
  const subgraphPoolsSorted = _(allPoolsRaw)
    .sortBy(tokenListPool => -tokenListPool.reserve)
    .value();
  const poolAddressesSoFar = new Set<string>();
  const addToAddressSet = (pools: SubgraphPool[]) => {
    _(pools)
      .map(pool => pool.id)
      .forEach(poolAddress => poolAddressesSoFar.add(poolAddress));
  };
  // select best possible pools from all raw pools
  const tokenInAddress = tokenIn.address;
  const tokenOutAddress = tokenOut.address;
  const baseTokens = baseTokensByChain[chainId];

  // filter pools between base token and tokenIn
  const topByBaseWithTokenIn = _(baseTokens)
    .flatMap((token: Token) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          const tokenAddress = token.address;
          return (
            (subgraphPool.token0.id == tokenInAddress &&
              subgraphPool.token1.id == tokenAddress) ||
            (subgraphPool.token0.id == tokenAddress &&
              subgraphPool.token1.id === tokenInAddress)
          );
        })
        .sortBy(tokenListPool => -tokenListPool.reserve)
        .slice(0, topNWithEachBaseToken)
        .value();
    })
    .sortBy(tokenListPool => -tokenListPool.reserve)
    .slice(0, topNWithBaseToken)
    .value();

  // filter pools between base token and tokenOut
  const topByBaseWithTokenOut = _(baseTokens)
    .flatMap((token: Token) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          const tokenAddress = token.address;
          return (
            (subgraphPool.token0.id == tokenOutAddress &&
              subgraphPool.token1.id == tokenAddress) ||
            (subgraphPool.token0.id == tokenAddress &&
              subgraphPool.token1.id === tokenOutAddress)
          );
        })
        .sortBy(tokenListPool => -tokenListPool.reserve)
        .slice(0, topNWithEachBaseToken)
        .value();
    })
    .sortBy(tokenListPool => -tokenListPool.reserve)
    .slice(0, topNWithBaseToken)
    .value();

  if (topNWithBaseTokenInSet) {
    addToAddressSet(topByBaseWithTokenIn);
    addToAddressSet(topByBaseWithTokenOut);
  }

  // need to quote weth for gas estimation
  let top2EthQuoteTokenPool: SubgraphPool[] = [];
  const wethAddress = WETH9[chainId]!.address;
  if (
    tokenOut.symbol != 'WETH' &&
    tokenOut.symbol != 'ETH' &&
    tokenOut.symbol != 'WETH9'
  ) {
    top2EthQuoteTokenPool = _(subgraphPoolsSorted)
      .filter(subgraphPool => {
        if (tradeType == TradeType.EXACT_INPUT) {
          return (
            (subgraphPool.token0.id == wethAddress &&
              subgraphPool.token1.id == tokenOutAddress) ||
            (subgraphPool.token1.id == wethAddress &&
              subgraphPool.token0.id == tokenOutAddress)
          );
        } else {
          return (
            (subgraphPool.token0.id == wethAddress &&
              subgraphPool.token1.id == tokenInAddress) ||
            (subgraphPool.token1.id == wethAddress &&
              subgraphPool.token0.id == tokenInAddress)
          );
        }
      })
      .slice(0, 1)
      .value();
  }
  addToAddressSet(top2EthQuoteTokenPool);

  // filter pools from remaining tokens
  const topByTVL = _(subgraphPoolsSorted)
    .filter(subgraphPool => {
      return !poolAddressesSoFar.has(subgraphPool.id);
    })
    .slice(0, topN)
    .value();

  addToAddressSet(topByTVL);

  const topByTVLUsingTokenIn = _(subgraphPoolsSorted)
    .filter(subgraphPool => {
      return (
        !poolAddressesSoFar.has(subgraphPool.id) &&
        (subgraphPool.token0.id == tokenInAddress ||
          subgraphPool.token1.id == tokenInAddress)
      );
    })
    .slice(0, topNTokenInOut)
    .value();
  addToAddressSet(topByTVLUsingTokenIn);

  const topByTVLUsingTokenOut = _(subgraphPoolsSorted)
    .filter(subgraphPool => {
      return (
        !poolAddressesSoFar.has(subgraphPool.id) &&
        (subgraphPool.token0.id == tokenOutAddress ||
          subgraphPool.token1.id == tokenOutAddress)
      );
    })
    .slice(0, topNTokenInOut)
    .value();
  addToAddressSet(topByTVLUsingTokenOut);

  // add two-hops path
  const topByTVLUsingTokenInSecondHops = _(topByTVLUsingTokenIn)
    .map(subgraphPool => {
      return subgraphPool.token0.id == tokenInAddress
        ? subgraphPool.token1.id
        : subgraphPool.token0.id;
    })
    .flatMap((secondHopId: string) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          return (
            !poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == secondHopId ||
              subgraphPool.token1.id == secondHopId)
          );
        })
        .slice(0, topNSecondHop)
        .value();
    })
    .uniqBy(pool => pool.id)
    .sortBy(pool => -pool.reserve)
    .slice(0, topNSecondHop)
    .value();

  addToAddressSet(topByTVLUsingTokenInSecondHops);

  const topByTVLUsingTokenOutSecondHops = _(topByTVLUsingTokenOut)
    .map(subgraphPool => {
      return subgraphPool.token0.id == tokenOutAddress
        ? subgraphPool.token1.id
        : subgraphPool.token0.id;
    })
    .flatMap((secondHopId: string) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          return (
            !poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == secondHopId ||
              subgraphPool.token1.id == secondHopId)
          );
        })
        .slice(0, topNSecondHop)
        .value();
    })
    .uniqBy(pool => pool.id)
    .sortBy(pool => -pool.reserve)
    .slice(0, topNSecondHop)
    .value();

  addToAddressSet(topByTVLUsingTokenOutSecondHops);

  // collect all filtered pools
  const subgraphPools = _([
    ...topByBaseWithTokenIn,
    ...topByBaseWithTokenOut,
    ...top2EthQuoteTokenPool,
    ...topByTVL,
    ...topByTVLUsingTokenIn,
    ...topByTVLUsingTokenOut,
    ...topByTVLUsingTokenInSecondHops,
    ...topByTVLUsingTokenOutSecondHops,
  ])
    .compact()
    .uniqBy(pool => pool.id)
    .value();

  // get tokens and their infos on-chain
  const tokenAddresses = _(subgraphPools)
    .flatMap(subgraphPool => {
      return [subgraphPool.token0.id, subgraphPool.token1.id];
    })
    .compact()
    .uniq()
    .value();

  const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, {
    blockNumber,
  });

  const tokenPairsRaw = _.map<SubgraphPool, [Token, Token] | undefined>(
    subgraphPools,
    subgraphPool => {
      const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
      const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
      if (!tokenA || !tokenB) {
        logger.info(
          `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}`
        );
        return undefined;
      }
      return [tokenA, tokenB];
    }
  );

  const tokenPairs = _.compact(tokenPairsRaw);
  const poolAccessor = await poolProvider.getPool(tokenPairs);

  return { poolAccessor };
}

// find best partition among all route paths
export function getBestSwapRoute(
  amount: TokenAmount,
  percents: number[],
  routesWithValidQuotes: RouteWithValidQuote[],
  tradeType: TradeType,
  routingConfig: RoutingConfig
): SwapRoute | undefined {
  const blockNumber = 0;

  // sort with quotes for each percents
  const percentToQuotes: { [percent: number]: RouteWithValidQuote[] } = {};
  for (const routeWithValidQuote of routesWithValidQuotes) {
    if (!percentToQuotes[routeWithValidQuote.percent]) {
      percentToQuotes[routeWithValidQuote.percent] = [];
    }
    percentToQuotes[routeWithValidQuote.percent].push(routeWithValidQuote);
  }

  const quoteCompFn =
    tradeType == TradeType.EXACT_INPUT
      ? (a: TokenAmount, b: TokenAmount) => a.greatThan(b)
      : (a: TokenAmount, b: TokenAmount) => a.lessThan(b);

  const percentToSortedQuotes = _.mapValues(
    percentToQuotes,
    (routeQuotes: RouteWithValidQuote[]) => {
      return routeQuotes.sort((routeQuoteA, routeQuoteB) => {
        return quoteCompFn(
          routeQuoteA.quoteAdjustedForGas,
          routeQuoteB.quoteAdjustedForGas
        )
          ? -1
          : 1;
      });
    }
  );

  const sumFn = (tokenAmounts: TokenAmount[]): TokenAmount => {
    let sum = tokenAmounts[0]!;
    for (let i = 1; i < tokenAmounts.length; ++i) {
      sum = sum.add(tokenAmounts[i]!);
    }
    return sum;
  };

  const queue = new Queue<{
    percentIndex: number;
    curRoutes: RouteWithValidQuote[];
    remainingPercent: number;
  }>();
  // init queue
  for (let i = percents.length; i >= 0; i--) {
    const percent = percents[i]!;
    if (!percentToSortedQuotes[percent]) {
      continue;
    }
    queue.enqueue({
      percentIndex: i,
      curRoutes: [percentToSortedQuotes[percent]![0]!],
      remainingPercent: 100 - percent,
    });
  }

  const { minSplits, maxSplits } = routingConfig;
  let splits = 1;
  let bestSwap: RouteWithValidQuote[] | undefined;
  let bestQuote: TokenAmount | undefined;

  while (queue.size > 0) {
    const { remainingPercent, curRoutes, percentIndex } = queue.dequeue()!;
    splits++;
    if (splits > maxSplits) {
      continue;
    }
    for (let i = percentIndex; i >= 0; i--) {
      const percentA = percents[i];
      if (percentA > remainingPercent) {
        continue;
      }

      if (!percentToSortedQuotes[percentA]) {
        continue;
      }
      const candidateRoutesA = percentToSortedQuotes[percentA];
      const routeWithQuoteA = findFirstRouteNotUsingUsedPools(
        curRoutes,
        candidateRoutesA
      );
      if (!routeWithQuoteA) {
        continue;
      }

      const remainingPercentNew = remainingPercent - percentA;
      const curRoutesNew = [...curRoutes, routeWithQuoteA];

      if (remainingPercentNew == 0 && splits >= minSplits) {
        const quotesNew = _.map(curRoutesNew, r => r.quoteAdjustedForGas);
        const quoteNew = sumFn(quotesNew);
        if (!bestQuote || quoteCompFn(quoteNew, bestQuote)) {
          bestQuote = quoteNew;
          bestSwap = curRoutesNew;
        }
      } else {
        queue.enqueue({
          curRoutes: curRoutesNew,
          percentIndex: i,
          remainingPercent: remainingPercentNew,
        });
      }
    }
  }
  if (!bestSwap) {
    logger.info('cannot find a valid swap');
    return undefined;
  }

  const quoteAdjustedForGas = sumFn(
    _.map(bestSwap, routeWithValidQuote => {
      return routeWithValidQuote.quoteAdjustedForGas;
    })
  );

  const quote = sumFn(
    _.map(bestSwap, routeWithValidQuote => {
      return routeWithValidQuote.quoteAdjustedForGas;
    })
  );

  // handle dust amount here
  const totalAmount = _.reduce(
    bestSwap,
    (total, routeAmount) => {
      return total.add(routeAmount.amount);
    },
    new TokenAmount(bestSwap[0]!.amount.token, BigNumber.from(0))
  );

  const missingAmount = amount.subtract(totalAmount);
  if (missingAmount.amount.gt(0)) {
    logger.info(`missing amount: ${missingAmount}`);
    // add dust to the last path
    bestSwap[bestSwap.length - 1]!.amount =
      bestSwap[bestSwap.length - 1]!.amount.add(missingAmount);
  }

  return { routes: bestSwap, blockNumber, quote, quoteAdjustedForGas };
}

// make sure that dont select used pools again to avoid trading effects on the same pool
const findFirstRouteNotUsingUsedPools = (
  usedRoutes: RouteWithValidQuote[],
  candidateRouteQuotes: RouteWithValidQuote[]
): RouteWithValidQuote | null => {
  const poolAddressSet = new Set();
  const usedPoolAddresses = _(usedRoutes)
    .flatMap(r => r.poolAddresses)
    .value();
  for (const poolAddress of usedPoolAddresses) {
    poolAddressSet.add(poolAddress);
  }

  for (const routeQuote of candidateRouteQuotes) {
    if (
      routeQuote.poolAddresses.some(poolAddress =>
        poolAddressSet.has(poolAddress)
      )
    ) {
      continue;
    }
    return routeQuote;
  }
  return null;
};

export { getAmountDistribution };
