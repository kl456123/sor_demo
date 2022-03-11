import { BigNumber, ethers, providers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { TokenAmount } from '../src/entities';
import { DirectSwapRoute, PoolV2 } from '../src/entitiesv2';
import { getCurveInfosForTokens } from '../src/markets/curve';
import { UniswapV3PoolData } from '../src/markets/uniswapv3_subgraph_provider';
import { DexSample, Sampler } from '../src/sampler';
import { ChainId, Protocol } from '../src/types';

jest.setTimeout(100000);

describe('test quote provider', () => {
  let provider: providers.BaseProvider;
  let sampler: Sampler;
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId]!;

  beforeAll(() => {
    provider = ethers.providers.getDefaultProvider();
    sampler = new Sampler(chainId, provider, {});
  });

  async function testGetQuotes(
    directSwapRoutes: DirectSwapRoute[],
    fillAmounts: BigNumber[],
    isSell: boolean
  ) {
    const samplerRoutes = directSwapRoutes.map(route => {
      return sampler.fillParams(route);
    });
    const op = isSell
      ? sampler.getSellQuotes(fillAmounts, samplerRoutes)
      : sampler.getBuyQuotes(fillAmounts, samplerRoutes);
    const [dexQuotes] = await sampler.executeAsync(op);
    expect(dexQuotes.length).toEqual(samplerRoutes.length);
    (dexQuotes as DexSample[][]).forEach(dexQuote => {
      expect(dexQuote.length).toEqual(fillAmounts.length);
      dexQuote.forEach(quote => {
        expect(quote.input.gt(0)).toBeTruthy();
        expect(quote.output.gt(0)).toBeTruthy();
      });
    });
  }

  test('test uniswapv2 like sample', async () => {
    // USDC => WETH
    const fillAmounts = [
      ethers.utils.parseUnits('2000', 6),
      ethers.utils.parseUnits('4000', 6),
    ];
    const directSwapRoutes: DirectSwapRoute[] = [];
    const protocol = Protocol.UniswapV2;
    const tokensAmount = [
      new TokenAmount(tokens.USDC, 10),
      new TokenAmount(tokens.WETH, 10),
    ];
    const poolId = '0x';
    const pool = new PoolV2(tokensAmount, poolId, protocol);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.USDC, tokens.WETH));
    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });

  test('test balancerv2 sample', async () => {
    // DAI => USDC
    const fillAmounts = [
      ethers.utils.parseUnits('10', 18),
      ethers.utils.parseUnits('30', 18),
    ];
    const poolId =
      '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e';

    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.WBTC, 10),
    ];
    const directSwapRoutes: DirectSwapRoute[] = [];
    const protocol = Protocol.BalancerV2;
    const pool = new PoolV2(tokensAmount, poolId, protocol);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.WBTC));

    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });

  test('test curvev1 sample', async () => {
    const fillAmounts = [
      ethers.utils.parseUnits('10', 6),
      ethers.utils.parseUnits('30', 6),
    ];
    // USDC => USDT
    const path = [tokens.USDC.address, tokens.USDT.address];
    const curveInfos = getCurveInfosForTokens(path[0], path[1]);

    const tokensAmount = [
      new TokenAmount(tokens.USDC, 10),
      new TokenAmount(tokens.USDT, 10),
    ];
    const protocol = Protocol.Curve;
    const directSwapRoutes = curveInfos.map(curveInfo => {
      const pool = new PoolV2(tokensAmount, curveInfo.poolAddress, protocol);
      return new DirectSwapRoute(pool, tokens.USDC, tokens.USDT);
    });

    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });

  test('test dodov1 sample', async () => {
    const fillAmounts = [
      ethers.utils.parseUnits('10', 18),
      ethers.utils.parseUnits('30', 18),
    ];
    const poolAddress = '0x';
    // USDC => USDT
    const directSwapRoutes: DirectSwapRoute[] = [];
    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.USDC, 10),
    ];
    const protocol = Protocol.DODO;
    const pool = new PoolV2(tokensAmount, poolAddress, protocol);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.USDC));

    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });

  test('test dodov2 sample', async () => {
    const fillAmounts = [
      ethers.utils.parseUnits('10', 18),
      ethers.utils.parseUnits('30', 18),
    ];
    const poolAddress = '0x';
    // USDC => USDT
    const directSwapRoutes: DirectSwapRoute[] = [];
    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.USDC, 10),
    ];
    const protocol = Protocol.DODOV2;
    const pool = new PoolV2(tokensAmount, poolAddress, protocol);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.USDC));

    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });

  test.only('test uniswapv3 sample', async () => {
    const fillAmounts = [
      ethers.utils.parseUnits('2960', 18),
      ethers.utils.parseUnits('3000', 18),
    ];

    // DAI => USDC
    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.USDC, 10),
    ];
    const poolAddress = '0x';
    const directSwapRoutes: DirectSwapRoute[] = [];
    const protocol = Protocol.UniswapV3;
    const poolData = { feeTier: 3000 } as UniswapV3PoolData;
    const pool = new PoolV2(tokensAmount, poolAddress, protocol, poolData);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.USDC));

    await testGetQuotes(directSwapRoutes, fillAmounts, true);
    // await testGetQuotes(directSwapRoutes, fillAmounts, false);
  });
  test('test kyber sample', async () => {});

  test('test bancor sample', async () => {});

  test('test balancerv1 sample', async () => {});
  test('test native order sample', async () => {});
});
