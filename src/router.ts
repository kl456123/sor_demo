import { providers } from 'ethers';
import _ from 'lodash';

import {
  computeAllRoutes,
  getAmountDistribution,
  getBestSwapRoute,
  getCandidatePools,
} from './algorithm';
import { DEFAULT_ROUTER_CONFIG } from './constants';
import { RouteWithValidQuote, Token, TokenAmount } from './entities';
import { GasPriceProvider } from './gasprice-provider';
import { IPoolProvider, PoolProvider } from './pool_provider';
import { QuoteProvider } from './quote-provider';
import {
  ISubgraphPoolProvider,
  StaticFileSubgraphProvider,
} from './static-file-subgraph-provider';
import { ITokenProvider, TokenProvider } from './token_provider';
import {
  ChainId,
  RoutingConfig,
  SwapConfig,
  SwapRoute,
  TradeType,
} from './types';

export abstract class IRouter {
  abstract route(
    amount: TokenAmount,
    quoteToken: Token,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRoute | undefined>;
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
  protected subgraphPoolProvider: ISubgraphPoolProvider;
  protected tokenProvider: ITokenProvider;
  protected poolProvider: IPoolProvider;
  constructor({ chainId, provider }: AlphaRouterParams) {
    this.chainId = chainId;
    // node provider
    this.provider = provider;

    // data provider
    this.quoteProvider = new QuoteProvider({ samplerAddress: '0x' });
    this.gasPriceProvider = new GasPriceProvider();
    this.subgraphPoolProvider = new StaticFileSubgraphProvider();
    this.tokenProvider = new TokenProvider(this.chainId);
    this.poolProvider = new PoolProvider();
  }

  public async route(
    amount: TokenAmount,
    quoteToken: Token,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig: Partial<RoutingConfig> = {}
  ): Promise<SwapRoute | undefined> {
    const blockNumber =
      partialRoutingConfig.blockNumber ??
      (await this.provider.getBlockNumber());
    const routingConfig: RoutingConfig = _.merge(
      {},
      DEFAULT_ROUTER_CONFIG,
      partialRoutingConfig,
      { blockNumber }
    );

    const { distributionPercent } = routingConfig;
    const [percents, amounts] = getAmountDistribution(
      amount,
      distributionPercent
    );

    const { gasPriceWei } = this.gasPriceProvider.getGasPrice();

    // get all pools first
    const tokenIn =
      tradeType == TradeType.EXACT_INPUT ? amount.token : quoteToken;
    const tokenOut =
      tradeType == TradeType.EXACT_INPUT ? quoteToken : amount.token;
    const { poolAccessor } = await getCandidatePools({
      tokenIn,
      tokenOut,
      routingConfig,
      tradeType,
      subgraphPoolProvider: this.subgraphPoolProvider,
      tokenProvider: this.tokenProvider,
      poolProvider: this.poolProvider,
      chainId: this.chainId,
    });
    const pools = poolAccessor.getAllPools();

    // compute all possible routes
    const { maxSwapsPerPath } = routingConfig;
    const routes = computeAllRoutes(tokenIn, tokenOut, pools, maxSwapsPerPath);
    if (routes.length == 0) {
      // handler except
      return undefined;
    }
    // get quotes
    const quoteFn =
      tradeType == TradeType.EXACT_INPUT
        ? this.quoteProvider.getQuotesManyExactIn.bind(this.quoteProvider)
        : this.quoteProvider.getQuotesManyExactOut.bind(this.quoteProvider);
    const routesWithQuotes = await quoteFn(amounts, routes);

    // postprocess of routes with quotes
    const allRoutesWithValidQuotes = [];
    for (const routeWithQuote of routesWithQuotes) {
      // route with many quotes for different amount percents
      const [route, quotes] = routeWithQuote;

      for (let i = 0; i < quotes.length; ++i) {
        const amountQuote = quotes[i];
        const percent = percents[i];
        const { quote, amount } = amountQuote;
        // skip if no quote
        if (!quote) {
          continue;
        }
        const routeWithValidQuote = new RouteWithValidQuote({
          quoteToken,
          amount,
          route,
          rawQuote: quote,
          percent,
          poolProvider: this.poolProvider,
          tradeType,
        });

        allRoutesWithValidQuotes.push(routeWithValidQuote);
      }
    }

    // get best route
    const swapRoute = getBestSwapRoute(
      amount,
      percents,
      allRoutesWithValidQuotes,
      tradeType,
      this.chainId,
      routingConfig
    );
    if (!swapRoute) {
      return undefined;
    }

    return swapRoute;
  }
}
