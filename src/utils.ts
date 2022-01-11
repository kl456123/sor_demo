import _ from 'lodash';

import { Route, RouteWithValidQuote, TokenAmount } from './entities';

export const routeToString = (route: Route) => {
  const routeStr = [];

  for (let i = 0; i < route.path.length; ++i) {
    routeStr.push(`${route.path[i].symbol}`);
    if (i < route.pools.length) {
      routeStr.push(`-->(pool: ${route.protocol})-->`);
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
    return `${amount.amount.toString()} = ${routeToString(
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
