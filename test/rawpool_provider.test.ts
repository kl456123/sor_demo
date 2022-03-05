import { RawPoolProvider } from '../src/rawpool_provider';
import { ChainId, Protocol } from '../src/types';

jest.setTimeout(100000);

describe('RawPoolProvider Test', () => {
  const rawPoolProvider: RawPoolProvider = new RawPoolProvider(ChainId.MAINNET);
  beforeAll(() => {});

  it('getRawPools Test', async () => {
    const protocols: Protocol[] = [
      Protocol.UniswapV2,
      Protocol.BalancerV2,
      Protocol.Curve,
    ];
    for (const protocol of protocols) {
      const rawPools = await rawPoolProvider.getRawPools([protocol]);
      expect(rawPools.length).toBeGreaterThan(0);
    }
  });

  it('getPools Test', async () => {});
});
