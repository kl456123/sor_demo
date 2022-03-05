import { BigNumber } from 'ethers';
import _ from 'lodash';
import { Queue } from 'mnemonist';

import { baseTokensByChain, WETH9 } from './base_token';
import { RouteWithValidQuote, Token, TokenAmount } from './entities';
import { PoolV2 as Pool, RouteV2 as Route } from './entitiesv2';
import { logger } from './logging';
import { PoolAccessor, RawPoolProvider } from './rawpool_provider';
import { SourceFilters } from './source_filters';
import { ITokenProvider } from './token_provider';
import { ChainId, RawPool, RoutingConfig, SwapRoute, TradeType } from './types';
import { routeToString } from './utils';

// handle dust in the end of algorithm to make sure the sum of amounts equals to 100%
export const getAmountDistribution = (
  amount: TokenAmount,
  distributionPercent: number
): [number[], TokenAmount[]] => {
  const percents = [];
  const amounts = [];
  for (let i = 1; i <= 100 / distributionPercent; ++i) {
    percents.push(i * distributionPercent);
    amounts.push(amount.multiply(i * distributionPercent).divide(100));
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
    tokenOut: Token,
    currentRoute: Pool[],
    currentTokens: Token[],
    previousTokenOut: Token
  ) => {
    // check if it succeeds
    if (currentRoute.length > maxHops) {
      return;
    }

    if (
      currentRoute.length > 0 &&
      currentTokens[currentTokens.length - 1].equals(tokenOut)
    ) {
      // deep copy
      routes.push(new Route([...currentRoute], [...currentTokens]));
      return;
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
      poolsUsed[i] = true;
      currentRoute.push(curPool);

      for (const currentTokenOut of curPool.tokens) {
        if (currentTokenOut.equals(previousTokenOut)) continue;

        currentTokens.push(currentTokenOut);
        computeRoutes(tokenOut, currentRoute, currentTokens, currentTokenOut);
        currentTokens.pop();
      }
      // rollback
      currentRoute.pop();
      poolsUsed[i] = false;
    }
  };

  computeRoutes(tokenOut, [], [tokenIn], tokenIn);

  logger.info(
    routes.map(routeToString),
    `Computed ${routes.length} possible routes.`
  );
  return routes;
}

export type GetCandidatePoolsParams = {
  tokenIn: Token;
  tokenOut: Token;
  tradeType: TradeType;
  routingConfig: RoutingConfig;
  rawPoolProvider: RawPoolProvider;
  tokenProvider: ITokenProvider;
  chainId: ChainId;
};

// filter out unless pools
export async function getCandidatePools({
  tokenIn,
  tokenOut,
  tradeType,
  routingConfig,
  rawPoolProvider,
  tokenProvider,
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
  // filter sources that is both supported and requested
  const { includedSources, excludedSources } = routingConfig;
  const requestFilters = SourceFilters.all()
    .exclude(excludedSources)
    .include(includedSources);
  // fetch pools from subgraph or ifps(static file)
  const allPoolsRaw = await rawPoolProvider.getRawPools(
    requestFilters.sources()
  );

  // sort by reserve
  const subgraphPoolsSorted = _(allPoolsRaw)
    .sortBy(tokenListPool => -tokenListPool.reserve)
    .value();
  const poolAddressesSoFar = new Set<string>();
  const addToAddressSet = (pools: RawPool[]) => {
    _(pools)
      .map(pool => pool.id)
      .forEach(poolAddress => poolAddressesSoFar.add(poolAddress));
  };
  // select best possible pools from all raw pools
  const tokenInAddress = tokenIn.address.toLowerCase();
  const tokenOutAddress = tokenOut.address.toLowerCase();
  const baseTokens = baseTokensByChain[chainId];

  // filter pools between base token and tokenIn
  const topByBaseWithTokenIn = _(baseTokens)
    .flatMap((token: Token) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          const tokenAddress = token.address.toLowerCase();
          return [tokenAddress, tokenInAddress].every(a =>
            subgraphPool.tokens.some(
              b => b.address.toLowerCase() === a.toLowerCase()
            )
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
          const tokenAddress = token.address.toLowerCase();
          return [tokenAddress, tokenOutAddress].every(a =>
            subgraphPool.tokens.some(
              b => b.address.toLowerCase() === a.toLowerCase()
            )
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
  let top2EthQuoteTokenPool: RawPool[] = [];
  const wethAddress = WETH9[chainId]?.address.toLowerCase();
  if (
    tokenOut.symbol != 'WETH' &&
    tokenOut.symbol != 'ETH' &&
    tokenOut.symbol != 'WETH9'
  ) {
    top2EthQuoteTokenPool = _(subgraphPoolsSorted)
      .filter(subgraphPool => {
        if (tradeType == TradeType.EXACT_INPUT) {
          return [wethAddress!, tokenOutAddress].every(a =>
            subgraphPool.tokens.some(
              b => b.address.toLowerCase() === a.toLowerCase()
            )
          );
        } else {
          return [wethAddress!, tokenInAddress].every(a =>
            subgraphPool.tokens.some(
              b => b.address.toLowerCase() === a.toLowerCase()
            )
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
        subgraphPool.tokens.some(
          token => token.address === tokenInAddress.toLowerCase()
        )
      );
    })
    .slice(0, topNTokenInOut)
    .value();
  addToAddressSet(topByTVLUsingTokenIn);

  const topByTVLUsingTokenOut = _(subgraphPoolsSorted)
    .filter(subgraphPool => {
      return (
        !poolAddressesSoFar.has(subgraphPool.id) &&
        subgraphPool.tokens.some(
          token => token.address === tokenOutAddress.toLowerCase()
        )
      );
    })
    .slice(0, topNTokenInOut)
    .value();
  addToAddressSet(topByTVLUsingTokenOut);

  // add two-hops path
  const topByTVLUsingTokenInSecondHops = _(topByTVLUsingTokenIn)
    .flatMap(subgraphPool => {
      return subgraphPool.tokens
        .filter(token => token.address !== tokenInAddress)
        .map(token => token.address);
    })
    .flatMap((secondHopId: string) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          return (
            !poolAddressesSoFar.has(subgraphPool.id) &&
            subgraphPool.tokens.some(
              token => token.address === secondHopId.toLowerCase()
            )
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
    .flatMap(subgraphPool => {
      return subgraphPool.tokens
        .filter(token => token.address !== tokenOutAddress)
        .map(token => token.address);
    })
    .flatMap((secondHopId: string) => {
      return _(subgraphPoolsSorted)
        .filter(subgraphPool => {
          return (
            !poolAddressesSoFar.has(subgraphPool.id) &&
            subgraphPool.tokens.some(
              token => token.address === secondHopId.toLowerCase()
            )
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
      return subgraphPool.tokens;
    })
    .compact()
    .uniqBy(tokenInfo => tokenInfo.address)
    .value();

  const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, {
    blockNumber,
  });

  const tokensMap: Record<string, Token> = {};
  _.forEach(tokenAddresses, tokenInfo => {
    tokensMap[tokenInfo.address] = tokenAccessor.getTokenByAddress(
      tokenInfo.address
    )!;
  });

  const poolAccessor = await rawPoolProvider.getPools(subgraphPools, tokensMap);

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
  for (let i = percents.length - 1; i >= 0; i--) {
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

  // init best swap with no splitted route path
  if (percentToSortedQuotes[100][0]) {
    bestSwap = [percentToSortedQuotes[100][0]];
    bestQuote = percentToSortedQuotes[100][0].quoteAdjustedForGas;
  }

  while (queue.size > 0) {
    let layer = queue.size;
    splits++;
    if (splits > maxSplits) {
      logger.info(`Max splits reached. Stopping search.`);
      break;
    }
    while (layer--) {
      const { remainingPercent, curRoutes, percentIndex } = queue.dequeue()!;

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
      return routeWithValidQuote.quote;
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
// NOTE: use pool keys to identify liquidity pool
const findFirstRouteNotUsingUsedPools = (
  usedRoutes: RouteWithValidQuote[],
  candidateRouteQuotes: RouteWithValidQuote[]
): RouteWithValidQuote | null => {
  const poolKeysSet = new Set();
  const usedPoolKeys = _(usedRoutes)
    .flatMap(r => r.poolKeys)
    .value();
  for (const poolKey of usedPoolKeys) {
    poolKeysSet.add(poolKey);
  }

  for (const routeQuote of candidateRouteQuotes) {
    if (routeQuote.poolKeys.some(poolKey => poolKeysSet.has(poolKey))) {
      continue;
    }
    return routeQuote;
  }
  return null;
};
