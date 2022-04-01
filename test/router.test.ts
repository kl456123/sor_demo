import { ethers, providers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { Token, TokenAmount } from '../src/entities';
import { MultiplexRouteWithValidQuote } from '../src/entitiesv2';
import { AlphaRouter } from '../src/router';
import { ChainId, TradeType } from '../src/types';

jest.setTimeout(10000);

describe('test AlphaRouter', () => {
  let alphaRouter: AlphaRouter;
  let chainId: ChainId;
  let provider: providers.BaseProvider;
  let tokens;
  let amount: TokenAmount;
  let quoteToken: Token;
  const transformerAddr = '';
  beforeAll(() => {
    chainId = ChainId.MAINNET;
    provider = ethers.getDefaultProvider('mainnet');
    alphaRouter = new AlphaRouter({ chainId, provider, transformerAddr });
    tokens = TOKENS[chainId]!;
    amount = new TokenAmount(
      tokens.USDC,
      ethers.utils.parseUnits('1000', tokens.USDC.decimals)
    );
    quoteToken = tokens.WETH;
  });

  test('test route of sell quote', async () => {
    const swapRouteOrNull = await alphaRouter.route(
      amount,
      quoteToken,
      TradeType.EXACT_INPUT
    );
    expect(swapRouteOrNull).not.toBeUndefined();
    const swapRoute = swapRouteOrNull!;
    expect(swapRoute.blockNumber).toBeGreaterThanOrEqual(0);
    expect(swapRoute.routeWithQuote.quote.greatThan(0)).toBeTruthy();
    expect(
      swapRoute.routeWithQuote.quoteAdjustedForGas.greatThan(0)
    ).toBeTruthy();
    const routeAmounts = swapRoute.routeWithQuote.routesWithQuote;
    expect(routeAmounts.length).toBeGreaterThan(0);
    routeAmounts.map((routeAmount: MultiplexRouteWithValidQuote) => {
      expect(routeAmount.amount.greatThan(0)).toBeTruthy();
      expect(routeAmount.quote.greatThan(0)).toBeTruthy();
      expect(routeAmount.routesWithQuote.length).toBeGreaterThanOrEqual(2);
    });
  });
});
