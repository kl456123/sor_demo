import { providers } from 'ethers';

import { TokenAmount } from './entities';
import { DirectSwapRoute, MultiplexRoute } from './entitiesv2';
import { GasModelFactory } from './gas-model';
import {
  ETHGasStationGasPriceProvider,
  IGasPriceProvider,
} from './gasprice-provider';
import { RawPoolProvider } from './rawpool_provider';
import { DexSample, Sampler } from './sampler';
import { AmountQuote, ChainId, TradeType } from './types';

// sample queries on single route for many quote amounts
export type RouteWithQuotes = [MultiplexRoute, AmountQuote[]];

const ETH_GAS_STATION_API_URL = 'https://ethgasstation.info/api/ethgasAPI.json';

export class QuoterProvider {
  protected sampler: Sampler;
  public gasPriceProvider: IGasPriceProvider;
  public gasModelFactory: GasModelFactory;
  constructor(
    public readonly chainId: ChainId,
    provider: providers.BaseProvider,
    protected readonly poolProvider: RawPoolProvider
  ) {
    this.sampler = new Sampler(chainId, provider, {});
    this.gasPriceProvider = new ETHGasStationGasPriceProvider(
      ETH_GAS_STATION_API_URL
    );
    this.gasModelFactory = new GasModelFactory(chainId, provider, poolProvider);
  }

  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routes: MultiplexRoute[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountOuts: TokenAmount[],
    routes: MultiplexRoute[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT);
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routes: MultiplexRoute[],
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    // TODO
    const directSwapRoutes = routes as DirectSwapRoute[];
    const fillAmounts = amounts.map(amt => amt.amount);
    const samplerRoutes = directSwapRoutes.map(route => {
      return {
        protocol: route.pool.protocol,
        path: [route.input.address, route.output.address],
        poolAddress: route.pool.id,
      };
    });
    let dexQuotes: DexSample[][];
    if (tradeType === TradeType.EXACT_INPUT) {
      [dexQuotes] = await this.sampler.executeAsync(
        this.sampler.getSellQuotes(fillAmounts, samplerRoutes)
      );
    } else {
      [dexQuotes] = await this.sampler.executeAsync(
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
