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
    const directSwapRoute = routeWithQuote.route as DirectSwapRoute;
    routeStr.push(`${directSwapRoute.input.symbol}`);
    routeStr.push(
      `-->(pool: ${directSwapRoute.pool.id}[${directSwapRoute.pool.protocol}(${routeWithQuote.percent}%)])-->`
    );
    routeStr.push(`${directSwapRoute.output.symbol}`);
    return routeStr.join('');
  }
  const resultStr = [];
  const routesStr = routeWithQuote.routesWithQuote.map(multiplexRouteQToString);
  if (routeWithQuote.routeType == RouteType.MULTI_HOP) {
    resultStr.push(`\n\n${routeWithQuote.percent}%\n`);
    resultStr.push(routesStr.join('\n=======>\n'));
    return resultStr.join('');
  }

  // fallback to batch route
  resultStr.push(routesStr.join('\n'));
  return resultStr.join('').toString();
};
