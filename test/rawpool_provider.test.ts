import _ from 'lodash';

import { ChainId, Protocol } from '../src/types';
import { RawPoolProvider } from '../src/rawpool_provider';
import { TOKENS } from '../src/base_token';

jest.setTimeout(100000);

describe('RawPoolProvider Test', () => {
  const rawPoolProvider: RawPoolProvider = new RawPoolProvider(ChainId.MAINNET);
  beforeAll(() => {});
  const tokens = TOKENS[ChainId.MAINNET]!;

  it('getRawPools Test', async () => {
    const protocols: Protocol[] = [
      // Protocol.UniswapV2,
      // Protocol.BalancerV2,
      // Protocol.Curve,
      // Protocol.UniswapV3,
      Protocol.CurveV2,
    ];
    for (const protocol of protocols) {
      const rawPools = await rawPoolProvider.getRawPools([protocol]);
      const newRawPools = _(rawPools).uniqBy(rawPool=>rawPool.id).value();
      expect(rawPools.length).toBeGreaterThan(0);
      expect(rawPools.length).toEqual(newRawPools.length);
      console.log(rawPoolProvider.getPoolAddressByString(tokens.WETH.address, tokens.USDT.address));
    }
  });

  it('getPools Test', async () => {});
});
