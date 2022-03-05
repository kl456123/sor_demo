import { BigNumber } from 'bignumber.js';
import _ from 'lodash';

import { Route, RouteWithValidQuote, TokenAmount } from './entities';
import {
  DirectSwapRoute,
  MultiplexRouteWithValidQuote,
  RouteType,
  RouteV2,
} from './entitiesv2';

export const routeToString = (route: Route | RouteV2) => {
  const routeStr = [];

  for (let i = 0; i < route.path.length; ++i) {
    routeStr.push(`${route.path[i].symbol}`);
    if (i < route.pools.length) {
      routeStr.push(`-->(pool: [${route.pools[i].protocol}])-->`);
    }
  }
  return routeStr.join('');
};

export const routeAmountsToString = (routeAmounts: RouteWithValidQuote[]) => {
  const total = _.reduce(
    routeAmounts,
    (total: TokenAmount, cur: RouteWithValidQuote) => {
      return total.add(cur.amount);
    },
    new TokenAmount(routeAmounts[0].amount.token, 0)
  );

  const routeStrings = _.map(routeAmounts, ({ route, amount, quote }) => {
    // use bignumber.js
    const percent = new BigNumber(amount.amount.toString()).div(
      total.amount.toString()
    );
    return `${percent.toFixed(2)} = ${routeToString(
      route
    )} = ${quote.amount.toString()}`;
  });
  return `total to swap: ${total.amount.toString()}, splited path:\n ${_.join(
    routeStrings,
    '\n'
  )}`;
};

export const routeAmountToString = (routeAmount: RouteWithValidQuote) => {
  const { route, amount } = routeAmount;
  return `${amount.amount.toString()} = ${routeToString(route)}`;
};

export const multiplexRouteQToString = (
  routeWithQuote: MultiplexRouteWithValidQuote
): string => {
  if (routeWithQuote.routeType == RouteType.DIRECTSWAP) {
    const routeStr = [];
    const directSwapRotue = routeWithQuote.route as DirectSwapRoute;
    routeStr.push(`${directSwapRotue.input.symbol}`);
    routeStr.push(
      `-->(pool: [${directSwapRotue.pool.protocol}(${routeWithQuote.percent}%)])-->`
    );
    routeStr.push(`${directSwapRotue.output.symbol}`);
    return routeStr.join('');
  }
  const routeStr = [];
  if (routeWithQuote.routeType == RouteType.MULTI_HOP) {
    routeStr.push(`${routeWithQuote.percent}%=>`);
  }
  routeStr.push(routeWithQuote.routesWithQuote.map(multiplexRouteQToString));
  return routeStr.join('');
};
