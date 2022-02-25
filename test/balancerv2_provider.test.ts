import { TOKENS } from '../src/base_token';
import { BalancerV2PoolsCache } from '../src/markets/balancerv2_provider';
import { ChainId } from '../src/types';

jest.setTimeout(100000);

describe('balancerv2_provider test', function () {
  const chainId: ChainId = ChainId.MAINNET;
  const balancerv2_provider = new BalancerV2PoolsCache(chainId);
  const tokens = TOKENS[chainId]!;

  it('getCachedPoolAddressForPair test', async () => {
    const takerToken = tokens.DAI;
    const makerToken = tokens.USDC;
    await balancerv2_provider.loadTopPoolsAsync();
    const poolIds =
      balancerv2_provider.getCachedPoolAddressForPair(
        takerToken.address.toLowerCase(),
        makerToken.address.toLowerCase()
      ) || [];
    console.log(poolIds);
    expect(poolIds.length).toBeGreaterThan(0);
  });
});
