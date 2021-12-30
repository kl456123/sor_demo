// get sample quotes from quote contracts on-chain
//
//
import { Sampler } from './sampler';
import { Route, RouteWithQuotes, TradeType } from './types';

export class QuoteProvider {
  private sampler: Sampler;
  constructor({ samplerAddress }: { samplerAddress: string }) {
    this.sampler = new Sampler(samplerAddress);
  }
  public async getQuotesManyExactIn(
    amountIns: number[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountIns: number[],
    routes: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_OUTPUT);
  }

  private async getQuotes(
    amounts: number[],
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
