import { BigNumber, ethers, providers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { QuoteProvider } from '../src/quote-provider';
import { DexSample, Sampler, SamplerRoute } from '../src/sampler';
import { ChainId, Protocol } from '../src/types';

// jest.setTimeout(10000);

describe('test quote provider', () => {
  let quoteProvider: QuoteProvider;
  let provider: providers.BaseProvider;
  let sampler: Sampler;
  let chainId: ChainId;

  // common quotes
  let tokens;
  let samplerRoutes: SamplerRoute[] = [];
  let fillAmounts: BigNumber[] = [];
  beforeAll(() => {
    chainId = ChainId.MAINNET;
    provider = ethers.getDefaultProvider('mainnet');
    quoteProvider = new QuoteProvider(chainId, provider);
    sampler = new Sampler(chainId, provider, {});
  });

  beforeEach(() => {
    tokens = TOKENS[chainId]!;
    // USDC => WETH
    const path = [tokens.USDC.address, tokens.WETH.address];
    samplerRoutes = [
      { protocol: Protocol.UniswapV2, path },
      { protocol: Protocol.SushiSwap, path },
    ];
    fillAmounts = [
      ...[
        ethers.utils.parseUnits('2000', 6),
        ethers.utils.parseUnits('4000', 6),
      ],
      ...fillAmounts,
    ];
  });

  test('test sell quote(EXACT_INPUT)', async () => {
    quoteProvider;
    // const routesWithQuotes = await quoteProvider.getQuotesManyExactIn();
  });

  test('test buy quote(EXACT_OUTPUT)', async () => {
    // const routesWithQuotes = await quoteProvider.getQuotesManyExactOut();
  });

  test('test sell sample(EXACT_INPUT)', async () => {
    const [dexQuotes] = await sampler.executeAsync(
      sampler.getSellQuotes(fillAmounts, samplerRoutes)
    );
    expect(dexQuotes.length).toEqual(samplerRoutes.length);
    (dexQuotes as DexSample[][]).forEach(dexQuote => {
      expect(dexQuote.length).toEqual(fillAmounts.length);
      dexQuote.forEach(quote => {
        expect(quote.input.gt(0)).toBeTruthy();
      });
    });
  });

  test('test buy sample(EXACT_OUTPUT)', async () => {
    // modify testdata for buy samples
    // amount for WETH token
    fillAmounts = [
      ethers.utils.parseUnits('10', 18),
      ethers.utils.parseUnits('30', 18),
    ];

    const [dexQuotes] = await sampler.executeAsync(
      sampler.getBuyQuotes(fillAmounts, samplerRoutes)
    );
    expect(dexQuotes.length).toEqual(samplerRoutes.length);
    (dexQuotes as DexSample[][]).forEach(dexQuote => {
      expect(dexQuote.length).toEqual(fillAmounts.length);
      dexQuote.forEach(quote => {
        expect(quote.input.gt(0)).toBeTruthy();
      });
    });
  });
});
