import { providers } from 'ethers';

import { getAmountDistribution, getBestSwapRoute } from './algorithm';
import { GasPriceProvider } from './gasprice-provider';
import { QuoteProvider } from './quote-provider';
import {
  ChainId,
  RoutingConfig,
  SwapConfig,
  SwapRoute,
  TradeType,
} from './types';

export abstract class IRouter {
  abstract route(
    amount: number,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRoute>;
}

export type AlphaRouterParams = {
  chainId: ChainId;
  provider: providers.BaseProvider;
};

export class AlphaRouter implements IRouter {
  protected chainId: ChainId;
  protected provider: providers.BaseProvider;
  protected quoteProvider: QuoteProvider;
  protected gasPriceProvider: GasPriceProvider;
  constructor({ chainId, provider }: AlphaRouterParams) {
    this.chainId = chainId;
    // node provider
    this.provider = provider;

    // data provider
    this.quoteProvider = new QuoteProvider();
    this.gasPriceProvider = new GasPriceProvider();
  }

  public async route(
    amount: number,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRoute> {
    const [percents, amounts] = getAmountDistribution(amount, routingConfig);
    // get quotes
    this.quoteProvider;

    // get best route
    const swapRoute = getBestSwapRoute();

    return swapRoute;
  }
}
