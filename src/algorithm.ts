import {
  ChainId,
  Pool,
  Route,
  RouteWithValidQuote,
  SwapRoute,
  Token,
  TradeType,
} from './types';

// handle dust in the end of algorithm to make sure the sum of amounts equals to 100%
const getAmountDistribution = (
  amount: number,
  distributionPercent: number
): [number[], number[]] => {
  const percents = [];
  const amounts = [];
  for (let i = 1; i < 100 / distributionPercent; ++i) {
    percents.push(i * distributionPercent);
    amounts.push((amount * i * distributionPercent) / 100);
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
  return routes;
}

// find best partition among all route paths
export function getBestSwapRoute(
  tradeType: TradeType,
  percentToQuotes: { [percent: number]: RouteWithValidQuote },
  percents: number[],
  chainId: ChainId
): SwapRoute {
  const routes: RouteWithValidQuote[] = [];
  const blockNumber = 0;
  const quote = 0;
  const quoteGasAdjusted = 0;

  return {
    quote,
    quoteGasAdjusted,
    blockNumber,
    routes,
  };
}
