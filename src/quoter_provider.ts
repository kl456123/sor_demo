import { providers } from 'ethers';

import { TokenAmount } from './entities';
import { DirectSwapRoute, MultiplexRoute } from './entitiesv2';
import { RawPoolProvider } from './rawpool_provider';
import { DexSample, Sampler } from './sampler';
import { AmountQuote, ChainId, TradeType } from './types';

// sample queries on single route for many quote amounts
export type RouteWithQuotes = [MultiplexRoute, AmountQuote[]];

export type CallOptions = {
  blockNumber?: number;
};

export class QuoterProvider {
  protected sampler: Sampler;
  constructor(
    public readonly chainId: ChainId,
    provider: providers.BaseProvider,
    protected readonly poolProvider: RawPoolProvider
  ) {
    this.sampler = new Sampler(chainId, provider, {});
  }

  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routes: MultiplexRoute[],
    options: CallOptions
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT, options);
  }

  public async getQuotesManyExactOut(
    amountOuts: TokenAmount[],
    routes: MultiplexRoute[],
    options: CallOptions
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT, options);
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routes: MultiplexRoute[],
    tradeType: TradeType,
    options: CallOptions
  ): Promise<RouteWithQuotes[]> {
    // TODO
    const directSwapRoutes = routes as DirectSwapRoute[];
    const fillAmounts = amounts.map(amt => amt.amount);
    const samplerRoutes = directSwapRoutes.map(route => {
      return this.sampler.fillParams(route);
    });
    let dexQuotes: DexSample[][];
    if (tradeType === TradeType.EXACT_INPUT) {
      [dexQuotes] = await this.sampler.executeAsync(
        options,
        this.sampler.getSellQuotes(fillAmounts, samplerRoutes)
      );
    } else {
      [dexQuotes] = await this.sampler.executeAsync(
        options,
        this.sampler.getBuyQuotes(fillAmounts, samplerRoutes)
      );
    }

    const routesWithQuotes: RouteWithQuotes[] = dexQuotes.map((dexQuote, i) => {
      const amountQuote = dexQuote.map((quote, j) => {
        return { amount: amounts[j], quote: quote.output };
      });
      return [directSwapRoutes[i], amountQuote];
    });
    return routesWithQuotes;
  }
}
