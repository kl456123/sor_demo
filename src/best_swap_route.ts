import { BigNumber } from 'ethers';
import _ from 'lodash';
import { Queue } from 'mnemonist';

import { globalBlacklist } from './blacklist';
import { TokenAmount } from './entities';
import {
  BatchRoute,
  DirectSwapRoute,
  MultiHopRoute,
  MultiplexRoute,
  MultiplexRouteWithValidQuote,
  RouteType,
} from './entitiesv2';
import { GasModelFactory } from './gas-model';
import { logger } from './logging';
import { QuoterProvider, RouteWithQuotes } from './quoter_provider';
import { RoutingConfig, TradeType } from './types';

export type SwapRouteV2 = {
  routeWithQuote: MultiplexRouteWithValidQuote;
  calldata?: string;
  blockNumber: number;
};

// auxially type
type RouteWithAmount = {
  route: MultiplexRoute;
  amount: TokenAmount;
  percent: number;
};

export type QuoteForMultiplexRouteParams = {
  routeWithAmount: RouteWithAmount;
  firstPercents: number[]; // for current route, note that always 100% for multihop
  secondPercents?: number[]; // for subroutes, always 100% for directswap
  tradeType: TradeType;
  routingConfig: RoutingConfig;
  quoterProvider: QuoterProvider;
};

export async function getBestSwapForMultiHopRoute(
  routeWithAmount: RouteWithAmount,
  percents: number[],
  tradeType: TradeType,
  routingConfig: RoutingConfig,
  gasModelFactory: GasModelFactory,
  quoterProvider: QuoterProvider
): Promise<SwapRouteV2 | undefined> {
  const blockNumber = 0;

  // only multihop route is supported now
  let outputTokenAmount = routeWithAmount.amount;
  const multiHopRoute = routeWithAmount.route as MultiHopRoute;
  const routes = [];
  for (const subRoute of multiHopRoute.routes) {
    const batchRoute = subRoute as BatchRoute;
    const swapRouteV2 = await getBestSwapForBatchRoute(
      // 100 percent for batch route due to that no batch of batch style exists in 1inch routes
      { amount: outputTokenAmount, percent: 100, route: batchRoute },
      percents,
      tradeType,
      routingConfig,
      gasModelFactory,
      quoterProvider
    );
    if (!swapRouteV2) {
      logger.warn(`Error when finding the best swap for multihop route`);
      return undefined;
    }
    outputTokenAmount = swapRouteV2.routeWithQuote.quoteAdjustedForGas;
    routes.push(swapRouteV2.routeWithQuote);
  }

  const lastSwapRoute = routes[routes.length - 1];
  const routeWithQuote = new MultiplexRouteWithValidQuote({
    amount: routeWithAmount.amount,
    percent: routeWithAmount.percent,
    routesWithQuote: routes,
    routeType: RouteType.MULTI_HOP,
    quote: lastSwapRoute.quote,
    quoteAdjustedForGas: lastSwapRoute.quoteAdjustedForGas,
  });
  return { routeWithQuote, blockNumber };
}

export async function postprocess(
  routesWithQuotes: RouteWithQuotes[],
  percents: number[],
  gasModelFactory: GasModelFactory,
  tradeType: TradeType
): Promise<MultiplexRouteWithValidQuote[]> {
  // gasPriceProvider;
  // gasModelFactory;
  // tradeType;
  // reorg and add gas estimation

  // postprocess of routes with quotes
  const allRoutesWithValidQuotes = [];
  for (const routeWithQuote of routesWithQuotes) {
    // route with many quotes for different amount percents
    const [route, quotes] = routeWithQuote;
    const directSwapRoute = route as DirectSwapRoute;
    const outputToken = directSwapRoute.output;
    const { estimateGasCost } = await gasModelFactory.buildGasModel(
      outputToken
    );
    const gasCostInToken = estimateGasCost(directSwapRoute);
    let quoteAdjustedForGas;
    let skip = true;

    for (let i = 0; i < quotes.length; ++i) {
      const amountQuote = quotes[i];
      const percent = percents[i];
      const { quote, amount } = amountQuote;
      // skip if no quote
      if (!quote || quote.lte(0)) {
        logger.warn(
          `Dropping a null quote ${amount.toString()} for ${
            directSwapRoute.output.symbol
          } in ${directSwapRoute.pool.protocol}(${directSwapRoute.pool.id}).`
        );
        break;
      }
      // consider the pool is useful if any quoted price exists
      skip = false;

      const quoteAmount = new TokenAmount(outputToken, quote);
      if (tradeType === TradeType.EXACT_INPUT) {
        if (quoteAmount.lessThan(gasCostInToken)) {
          // skip route if gas cost exceeds quote amount
          continue;
        }
        quoteAdjustedForGas = quoteAmount.subtract(gasCostInToken);
      } else {
        quoteAdjustedForGas = quoteAmount.add(gasCostInToken);
      }
      // quoteAdjustedForGas = quoteAmount;

      const routeWithValidQuote = new MultiplexRouteWithValidQuote({
        amount,
        percent,
        quote: quoteAmount,
        route,
        quoteAdjustedForGas,
        routesWithQuote: [], // empty for direct swap route
        routeType: RouteType.DIRECTSWAP,
      });

      allRoutesWithValidQuotes.push(routeWithValidQuote);
    }

    if (skip) {
      globalBlacklist().add(directSwapRoute.pool.id);
    }
  }

  return allRoutesWithValidQuotes;
}

function bfs(
  amount: TokenAmount,
  percents: number[],
  currentPercent: number,
  routesWithValidQuotes: MultiplexRouteWithValidQuote[],
  tradeType: TradeType,
  routingConfig: RoutingConfig
) {
  // sort with quotes for each percents
  const percentToQuotes: { [percent: number]: MultiplexRouteWithValidQuote[] } =
    {};
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
    (routeQuotes: MultiplexRouteWithValidQuote[]) => {
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
    let sum = tokenAmounts[0];
    for (let i = 1; i < tokenAmounts.length; ++i) {
      sum = sum.add(tokenAmounts[i]);
    }
    return sum;
  };

  const queue = new Queue<{
    percentIndex: number;
    curRoutes: MultiplexRouteWithValidQuote[];
    remainingPercent: number;
  }>();
  // init queue
  for (let i = percents.length; i >= 0; i--) {
    const percent = percents[i];
    if (!percentToSortedQuotes[percent]) {
      continue;
    }
    queue.enqueue({
      percentIndex: i,
      curRoutes: [percentToSortedQuotes[percent][0]],
      remainingPercent: 100 - percent,
    });
  }

  const { minSplits, maxSplits } = routingConfig;
  let splits = 1;
  let bestSwap: MultiplexRouteWithValidQuote[] | undefined;
  let bestQuote: TokenAmount | undefined;

  // init best swap with no splitted route path
  if (percentToSortedQuotes[100] && percentToSortedQuotes[100][0]) {
    bestSwap = [percentToSortedQuotes[100][0]];
    bestQuote = percentToSortedQuotes[100][0].quoteAdjustedForGas;
  }

  while (queue.size > 0) {
    let layer = queue.size;
    splits++;
    if (splits > maxSplits) {
      logger.debug(`Max splits reached. Stopping search.`);
      break;
    }
    logger.debug(`Process layer: ${layer} when splits: ${splits}.`);
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
    logger.warn('cannot find a valid swap');
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
    new TokenAmount(bestSwap[0].amount.token, BigNumber.from(0))
  );

  const missingAmount = amount.subtract(totalAmount);
  if (missingAmount.amount.gt(0)) {
    logger.debug(`missing amount: ${missingAmount}`);
    // add dust to the last path
    bestSwap[bestSwap.length - 1].amount =
      bestSwap[bestSwap.length - 1].amount.add(missingAmount);
  }

  const routeWithQuote = new MultiplexRouteWithValidQuote({
    amount,
    percent: currentPercent,
    routesWithQuote: bestSwap,
    routeType: RouteType.BATCH,
    quote: quote,
    quoteAdjustedForGas: quoteAdjustedForGas,
  });
  return routeWithQuote;
}

export async function getBestSwapForBatchRoute(
  routeWithAmount: RouteWithAmount,
  percents: number[],
  tradeType: TradeType,
  routingConfig: RoutingConfig,
  gasModelFactory: GasModelFactory,
  quoterProvider: QuoterProvider
): Promise<SwapRouteV2 | undefined> {
  const blockNumber = 0;
  const { amount, percent, route } = routeWithAmount;
  const batchRoute = route as BatchRoute;
  const routesWithValidQuotes = await quoteForDirectRoute(
    amount,
    batchRoute.routes as DirectSwapRoute[],
    percents,
    tradeType,
    routingConfig,
    gasModelFactory,
    quoterProvider
  );
  if (!routesWithValidQuotes.length) {
    logger.warn(`Error when finding the best swap for batch route`);
    return undefined;
  }

  const routeWithQuote = bfs(
    amount,
    percents,
    percent,
    routesWithValidQuotes,
    tradeType,
    routingConfig
  );
  if (!routeWithQuote) {
    return undefined;
  }

  return { routeWithQuote, blockNumber };
}

async function quoteForDirectRoute(
  amount: TokenAmount,
  routes: DirectSwapRoute[],
  percents: number[],
  tradeType: TradeType,
  routingConfig: RoutingConfig,
  gasModelFactory: GasModelFactory,
  quoterProvider: QuoterProvider
): Promise<MultiplexRouteWithValidQuote[]> {
  const quoteFn =
    tradeType == TradeType.EXACT_INPUT
      ? quoterProvider.getQuotesManyExactIn.bind(quoterProvider)
      : quoterProvider.getQuotesManyExactOut.bind(quoterProvider);
  const amounts = percents.map(percent => amount.multiply(percent).divide(100));
  const routesWithQuote = await quoteFn(amounts, routes, {
    blockNumber: routingConfig.blockNumber,
  });
  const routesWithValidQuotes = await postprocess(
    routesWithQuote,
    percents,
    gasModelFactory,
    tradeType
  );
  return routesWithValidQuotes;
}

async function quoteForMultiHopRoute(
  amount: TokenAmount,
  firstPercents: number[],
  secondPercents: number[],
  routes: MultiHopRoute[],
  tradeType: TradeType,
  routingConfig: RoutingConfig,
  gasModelFactory: GasModelFactory,
  quoterProvider: QuoterProvider
): Promise<MultiplexRouteWithValidQuote[]> {
  const multiHopRoutePromises = _.flatMap(firstPercents, percent => {
    const routeAmount = amount.multiply(percent).divide(100);
    return _.map(routes, curRoute =>
      getBestSwapForMultiHopRoute(
        { route: curRoute, amount: routeAmount, percent },
        secondPercents,
        tradeType,
        routingConfig,
        gasModelFactory,
        quoterProvider
      )
    );
  });
  const swapRoutesV2 = await Promise.all(multiHopRoutePromises);
  const routesWithValidQuotes = _(swapRoutesV2)
    .compact()
    .map(swapRouteV2 => swapRouteV2.routeWithQuote)
    .value();
  return routesWithValidQuotes;
}

// used for multiplex routes
export async function getBestSwapRouteV2(
  amount: TokenAmount,
  firstPercents: number[],
  secondPercents: number[],
  route: MultiplexRoute,
  tradeType: TradeType,
  routingConfig: RoutingConfig,
  gasModelFactory: GasModelFactory,
  quoterProvider: QuoterProvider
): Promise<SwapRouteV2 | undefined> {
  const blockNumber = routingConfig.blockNumber;

  const batchRoute = route as BatchRoute;

  const multiHopRoutes = batchRoute.routes as MultiHopRoute[];
  const routesWithValidQuotes = await quoteForMultiHopRoute(
    amount,
    firstPercents,
    secondPercents,
    multiHopRoutes,
    tradeType,
    routingConfig,
    gasModelFactory,
    quoterProvider
  );

  if (!routesWithValidQuotes.length) {
    return undefined;
  }

  const routeWithQuote = bfs(
    amount,
    firstPercents,
    100,
    routesWithValidQuotes,
    tradeType,
    routingConfig
  );
  if (!routeWithQuote) {
    return undefined;
  }

  return { routeWithQuote, blockNumber };
}

// make sure that dont select used pools again to avoid trading effects on the same pool
// NOTE: use pool keys to identify liquidity pool
const findFirstRouteNotUsingUsedPools = (
  usedRoutes: MultiplexRouteWithValidQuote[],
  candidateRouteQuotes: MultiplexRouteWithValidQuote[]
): MultiplexRouteWithValidQuote | null => {
  const poolKeysSet = new Set();
  const usedPoolKeys = _(usedRoutes)
    .flatMap(r => r.poolIds)
    .value();
  for (const poolKey of usedPoolKeys) {
    poolKeysSet.add(poolKey);
  }

  for (const routeQuote of candidateRouteQuotes) {
    if (routeQuote.poolIds.some(poolKey => poolKeysSet.has(poolKey))) {
      continue;
    }
    return routeQuote;
  }
  return null;
};
