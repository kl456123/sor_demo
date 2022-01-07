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
  public static placeRoute(routes: Route[], sources: Protocol[]): Route[] {
    const routesByProtocol = _.flatMap(routes, route => {
      return _.flatMap(sources, protocol => {
        switch (protocol) {
          case Protocol.UniswapV2:
          case Protocol.SushiSwap:
            return new Route(route.pools, route.input, route.output, protocol);
          case Protocol.Eth2Dai: {
            if (route.path.length !== 2) {
              return [];
            }
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
            if (route.path.length !== 2) {
              return [];
            }
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
          default:
            logger.warn(`Unsupported protocol: ${protocol}`);
            return [];
        }
      });
    });
    return routesByProtocol;
  }
}
