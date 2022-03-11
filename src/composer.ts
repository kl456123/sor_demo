import _ from 'lodash';

import {
  BatchRoute,
  DirectSwapRoute,
  MultiHopRoute,
  MultiplexRoute,
  RouteV2,
} from './entitiesv2';

export class Composer {
  public static compose(routes: RouteV2[]): MultiplexRoute {
    // merge routes with the same tokens(path) like 1inch
    const mergedRoutes: { [key: string]: RouteV2[] } = {};
    _.forEach(routes, route => {
      if (!mergedRoutes[route.routeKey]) {
        mergedRoutes[route.routeKey] = [];
      }
      mergedRoutes[route.routeKey].push(route);
    });
    const multiHopRoutes: MultiHopRoute[] = [];

    for (const pathkey of Object.keys(mergedRoutes)) {
      const routes = mergedRoutes[pathkey];
      const numHops = routes[0].pools.length;
      const batchRoutes: BatchRoute[] = [];
      for (let i = 0; i < numHops; ++i) {
        const allPools = _(routes)
          .map(route => route.pools[i])
          .uniqBy(pool => pool.id)
          .value();
        // topn
        const pools = _(allPools).slice(0, 5).value();
        // the same input tokens and output tokens for each route here
        const inputToken = routes[0].path[i];
        const outputToken = routes[0].path[i + 1];
        const outputTokens = pools.map(_pool => outputToken);
        const directSwapRoutes = pools.map(
          pool => new DirectSwapRoute(pool, inputToken, outputToken)
        );
        batchRoutes.push(
          new BatchRoute(directSwapRoutes, inputToken, outputTokens)
        );
      }
      multiHopRoutes.push(new MultiHopRoute(batchRoutes, routes[0].path));
    }
    const inputToken = multiHopRoutes[0].input;
    const outputTokens = multiHopRoutes.map(r => r.output);
    return new BatchRoute(multiHopRoutes, inputToken, outputTokens);
  }
}
