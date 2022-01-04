// get sample quotes from quote contracts on-chain
//
//
import { providers } from 'ethers';
import { Route, TokenAmount } from './entities';
import { ContractOperation, DexSample, Sampler } from './sampler';
import { ChainId, RouteWithQuotes, TradeType } from './types';

export class QuoteProvider {
  private sampler: Sampler;
  constructor(chainId: ChainId, provider: providers.BaseProvider) {
    this.sampler = new Sampler(chainId, provider, {});
  }
  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountOuts: TokenAmount[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT);
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routes: Route[],
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    let batchOp: ContractOperation<DexSample[][]>;
    const fillAmounts = amounts.map(amt => amt.amount);
    const samplerRoutes = routes.map(route => {
      return { protocol: route.protocol, path: route.path.map(p => p.address) };
    });
    if (tradeType === TradeType.EXACT_INPUT) {
      batchOp = this.sampler.getSellQuotes(fillAmounts, samplerRoutes);
    } else {
      batchOp = this.sampler.getBuyQuotes(fillAmounts, samplerRoutes);
    }
    const samplerPromise = this.sampler.executeAsync(batchOp);

    const dexQuotes: DexSample[][] = await samplerPromise;
    const routesWithQuotes: RouteWithQuotes[] = dexQuotes.map((dexQuote, i) => {
      const amountQuote = dexQuote.map((quote, j) => {
        return { amount: amounts[j], quote: quote.output };
      });
      return [routes[i], amountQuote];
    });

    return routesWithQuotes;
  }
}
