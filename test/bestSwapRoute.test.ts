import { ethers } from 'ethers';

import { getAmountDistribution } from '../src/algorithm';
import { TOKENS } from '../src/base_token';
import {
  getBestSwapForBatchRoute,
  getBestSwapForMultiHopRoute,
  getBestSwapRouteV2,
} from '../src/best_swap_route';
import { DEFAULT_ROUTER_CONFIG } from '../src/constants';
import { Token, TokenAmount } from '../src/entities';
import { BatchRoute, DirectSwapRoute, PoolV2 } from '../src/entitiesv2';
import { QuoterProvider } from '../src/quoter_provider';
import { RawPoolProvider } from '../src/rawpool_provider';
import { ChainId, Protocol, TradeType } from '../src/types';

describe('test bestSwapRouteV2', () => {
  const directSwapRoutes: DirectSwapRoute[] = [];
  let tokens: Record<string, Token>;
  const tradeType = TradeType.EXACT_INPUT;
  const routingConfig = DEFAULT_ROUTER_CONFIG;
  let quoterProvider: QuoterProvider;
  const chainId = ChainId.MAINNET;
  const protocol = Protocol.UniswapV2;
  const poolProvider = new RawPoolProvider(chainId);
  const nodeUrl =
    'https://eth-mainnet.alchemyapi.io/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03';
  const provider: ethers.providers.BaseProvider =
    new ethers.providers.JsonRpcProvider(nodeUrl);
  beforeAll(() => {
    tokens = TOKENS[chainId]!;
    quoterProvider = new QuoterProvider(chainId, provider, poolProvider);
    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.USDT, 10),
    ];
    const poolId = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852';
    const pool = new PoolV2(tokensAmount, poolId, protocol);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.USDT));
  });
  it('test getBestSwapForBatchRoute func', async () => {
    await poolProvider.getRawPools();
    const baseToken = tokens.WETH;
    const distributionPercent = 2;
    const amount = new TokenAmount(
      baseToken,
      ethers.utils.parseUnits('1000', baseToken.decimals)
    );
    const batchRoute = new BatchRoute(directSwapRoutes, tokens.WETH, [
      tokens.USDT,
    ]);
    const percents = getAmountDistribution(amount, distributionPercent)[0];
    const swapRouteV2 = await getBestSwapForBatchRoute(
      { amount, percent: 100, route: batchRoute },
      percents,
      tradeType,
      routingConfig,
      quoterProvider
    );
    expect(swapRouteV2).toBeDefined();
  });

  it('test getBestSwapForMultiHopRoute func', async () => {
    getBestSwapForMultiHopRoute;
  });

  it('test getBestSwapRouteV2 func', async () => {
    getBestSwapRouteV2;
  });
});
