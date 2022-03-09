import {
  DirectSwapRoute,
  MultiplexRouteWithValidQuote,
  RouteType,
  RouteV2,
} from './entitiesv2';

export const routeToString = (route: RouteV2) => {
  const routeStr = [];

  for (let i = 0; i < route.path.length; ++i) {
    routeStr.push(`${route.path[i].symbol}`);
    if (i < route.pools.length) {
      routeStr.push(
        `-->(pool: [${route.pools[i].protocol}], ${route.pools[i].id})-->`
      );
    }
  }
  return routeStr.join('');
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
