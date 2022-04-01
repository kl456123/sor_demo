import { TOKENS } from '../src/base_token';
import { BalancerV2PoolProvider } from '../src/markets/balancerv2_subgraph_provider';
import { ChainId } from '../src/types';

jest.setTimeout(100000);

describe('balancerv2_provider test', function () {
  const chainId: ChainId = ChainId.MAINNET;
  const balancerv2_provider = new BalancerV2PoolProvider(chainId);
  const tokens = TOKENS[chainId];

  it('getCachedPoolAddressForPair test', async () => {
    tokens;
    const poolIds = (await balancerv2_provider.getPools()) || [];
    expect(poolIds.length).toBeGreaterThan(0);
  });
});
