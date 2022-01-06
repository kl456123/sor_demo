import _ from 'lodash';

import { Route, RouteWithValidQuote, TokenAmount } from './entities';
import { Protocol } from './types';

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

  const routeStrings = _.map(
    routeAmounts,
    ({ route, amount, quoteAdjustedForGas }) => {
      return `${amount.amount.toString()} = ${routeToString(
        route
      )} = ${quoteAdjustedForGas.amount.toString()}`;
    }
  );
  return `total to swap: ${total.amount.toString()}, splited path:\n ${_.join(
    routeStrings,
    '\n'
  )}`;
};

export const routeAmountToString = (routeAmount: RouteWithValidQuote) => {
  const { route, amount } = routeAmount;
  return `${amount.amount.toString()} = ${routeToString(route)}`;
};

export const isValidSourceForRoute = (
  protocol: Protocol,
  route: Route
): boolean => {
  switch (protocol) {
    case Protocol.Eth2Dai: {
      if (route.path.length !== 2) {
        return false;
      }
      const symbols = _.map(route.path, token => token.symbol);
      return (
        (symbols[0] === 'DAI' && symbols[1] === 'WETH') ||
        (symbols[0] === 'WETH' && symbols[1] === 'DAI')
      );
    }
    default:
      return true;
  }
};
