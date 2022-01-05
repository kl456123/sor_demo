import _ from 'lodash';

import { Route, RouteWithValidQuote } from './entities';

export const routeToString = (route: Route) => {
  const routeStr = [];

  for (let i = 0; i < route.path.length; ++i) {
    routeStr.push(`${route.path[i].symbol}`);
    if (i < route.pools.length) {
      routeStr.push(`-->(pool: ${route.pools[i].protocol})-->`);
    }
  }
  return routeStr.join('');
};

export const routeAmountsToString = (routeAmounts: RouteWithValidQuote[]) => {
  const routeStrings = _.map(
    routeAmounts,
    ({ route, amount, quoteAdjustedForGas }) => {
      return `${amount.amount.toString()} = ${routeToString(
        route
      )} = ${quoteAdjustedForGas.amount.toString()}`;
    }
  );
  return _.join(routeStrings, '\n');
};

export const routeAmountToString = (routeAmount: RouteWithValidQuote) => {
  const { route, amount } = routeAmount;
  return `${amount.amount.toString()} = ${routeToString(route)}`;
};
