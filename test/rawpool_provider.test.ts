import _ from 'lodash';

import { TOKENS } from '../src/base_token';
import { RawPoolProvider } from '../src/rawpool_provider';
import { ChainId, Protocol } from '../src/types';

jest.setTimeout(100000);

describe('RawPoolProvider Test', () => {
  const rawPoolProvider: RawPoolProvider = new RawPoolProvider(ChainId.MAINNET);
  const tokens = TOKENS[ChainId.MAINNET];

  it('getRawPools Test', async () => {
    const protocols: Protocol[] = [
      // Protocol.UniswapV2,
      // Protocol.BalancerV2,
      Protocol.Curve,
      // Protocol.UniswapV3,
      // Protocol.Balancer,
    ];
    for (const protocol of protocols) {
      const rawPools = await rawPoolProvider.getRawPools([protocol]);
      const newRawPools = _(rawPools)
        .uniqBy(rawPool => rawPool.id)
        .value();
      expect(rawPools.length).toBeGreaterThan(0);
      expect(rawPools.length).toEqual(newRawPools.length);
      console.log(
        rawPoolProvider.getPoolAddressByString(
          tokens.USDT.address,
          tokens.USDC.address
        )
      );
    }
  });

  it('getPools Test', async () => {
    expect;
  });
});
