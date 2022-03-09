import _ from 'lodash';

import { Token } from '../entities';
import { IRawPoolProvider } from '../rawpool_provider';
import { RawPool, RawToken } from '../types';

import { CurveInfo, MAINNET_CURVE_INFOS } from './curve';

export class CurvePoolProvider implements IRawPoolProvider {
  public async getPools(): Promise<RawPool[]> {
    const curveInfos = Object.values(MAINNET_CURVE_INFOS);
    return _.map(curveInfos, (curveInfo: CurveInfo) => {
      const tokens: RawToken[] = _.map(curveInfo.tokens, (token: Token) => {
        return { address: token.address, symbol: token.symbol! };
      });
      const rawPool: RawPool = {
        protocol: 'Curve',
        id: curveInfo.poolAddress,
        tokens: tokens,
        reserve: 1818768655.005331,
      };
      return rawPool;
    });
  }
}
