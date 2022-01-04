// get sample quotes from quote contracts on-chain
//
//
import { Route, TokenAmount } from './entities';
import { Sampler } from './sampler';
import { RouteWithQuotes, TradeType } from './types';

export class QuoteProvider {
  private sampler: Sampler;
  constructor({ samplerAddress }: { samplerAddress: string }) {
    this.sampler = new Sampler(samplerAddress);
  }
  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountIns: TokenAmount[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_OUTPUT);
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routes: Route[],
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    const routesWithQuotes: RouteWithQuotes[] = [];
    if (tradeType === TradeType.EXACT_INPUT) {
    } else {
    }
    return routesWithQuotes;
  }
}
