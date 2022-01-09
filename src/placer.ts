import _ from 'lodash';

import { Route } from './entities';
import { logger } from './logging';
import { getCurveInfosForTokens } from './markets/curve';
import { Protocol } from './types';

export const placeRoute = () => {
  return '';
};

// place routes with all possible liquidity pools
export class Placer {
  public usedPoolKeys: Set<string>;
  constructor() {
    this.usedPoolKeys = new Set();
  }

  public static placeRoute(routes: Route[], sources: Protocol[]) {
    const routesByProtocol = _.flatMap(routes, route => {
      if (route.pools.length == 1) {
        return this.placeDirectRoute(route, sources);
      }
      return this.placeMultiHopRoute(route, sources);
    });

    // add route for limit order protocol
    const routesByLimitOrder = _.flatMap(routes, route => {
      if (route.pools.length !== 1) {
        // only direct swap for limit order
        return [];
      }
      return new Route(route.pools, route.input, route.output, Protocol.ZeroX);
    });
    return [routesByLimitOrder, routesByProtocol];
  }

  public static placeDirectRoute(route: Route, sources: Protocol[]): Route[] {
    return _.flatMap(sources, protocol => {
      switch (protocol) {
        case Protocol.UniswapV2:
        case Protocol.SushiSwap:
          return new Route(route.pools, route.input, route.output, protocol);
        case Protocol.Eth2Dai: {
          const symbols = _.map(route.path, token => token.symbol);
          const cond =
            (symbols[0] === 'DAI' && symbols[1] === 'WETH') ||
            (symbols[0] === 'WETH' && symbols[1] === 'DAI');
          if (cond) {
            return [];
          }
          return new Route(route.pools, route.input, route.output, protocol);
        }
        case Protocol.Curve: {
          const curveInfos = getCurveInfosForTokens(
            route.path[0].address,
            route.path[1].address
          );
          return _.map(curveInfos, curveInfo => {
            return new Route(
              route.pools,
              route.input,
              route.output,
              protocol,
              curveInfo.poolAddress
            );
          });
        }
        case Protocol.ZeroX:
          return [];
        default:
          logger.warn(`Unsupported protocol: ${protocol}`);
          return [];
      }
    });
  }

  public static placeMultiHopRoute(route: Route, sources: Protocol[]): Route[] {
    // const routes: Route[] = [];
    // for(let i =0; i<route.pools.length;++i){
    // const pool = route.pools[i];
    // }

    return _.flatMap(sources, protocol => {
      switch (protocol) {
        case Protocol.UniswapV2:
          return new Route(route.pools, route.input, route.output, protocol);
        default:
          return [];
      }
    });
  }
}
