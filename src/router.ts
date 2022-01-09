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
import { logger } from './logging';
import { Placer } from './placer';
import { IPoolProvider, PoolProvider } from './pool_provider';
import { QuoteProvider } from './quote-provider';
import { SourceFilters } from './source_filters';
import {
  ISubgraphPoolProvider,
  StaticFileSubgraphProvider,
} from './subgraph_provider';
import { ITokenProvider, TokenProvider } from './token_provider';
import { ChainId, RoutingConfig, SwapRoute, TradeType } from './types';
import { routeAmountsToString } from './utils';

export abstract class IRouter {
  abstract route(
    amount: TokenAmount,
    quoteToken: Token,
    tradeType: TradeType,
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
  protected sourceFilters: SourceFilters;
  constructor({ chainId, provider }: AlphaRouterParams) {
    this.chainId = chainId;
    // node provider
    this.provider = provider;

    // data provider
    this.quoteProvider = new QuoteProvider(chainId, provider);
    this.gasPriceProvider = new GasPriceProvider();
    this.subgraphPoolProvider = new StaticFileSubgraphProvider();
    this.tokenProvider = new TokenProvider(this.chainId);
    this.poolProvider = new PoolProvider(this.chainId);
    this.sourceFilters = SourceFilters.all();
  }

  public async route(
    amount: TokenAmount,
    quoteToken: Token,
    tradeType: TradeType,
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
    // log configs
    logger.info(`routing config: ${JSON.stringify(routingConfig, null, 2)}`);

    const { distributionPercent } = routingConfig;
    const [percents, amounts] = getAmountDistribution(
      amount,
      distributionPercent
    );

    const { gasPriceWei } = await this.gasPriceProvider.getGasPrice();
    gasPriceWei;

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
    // filter sources that is both supported and requested
    const { includedSources, excludedSources } = routingConfig;
    const requestFilters = SourceFilters.all()
      .exclude(excludedSources)
      .include(includedSources);
    const quoteFilters = this.sourceFilters.merge(requestFilters);
    const routesByProtocol = Placer.placeRoute(routes, quoteFilters.sources());

    // get quotes
    const quoteFn =
      tradeType == TradeType.EXACT_INPUT
        ? this.quoteProvider.getQuotesManyExactIn.bind(this.quoteProvider)
        : this.quoteProvider.getQuotesManyExactOut.bind(this.quoteProvider);
    const routesWithQuotes = await quoteFn(amounts, routesByProtocol[0], routesByProtocol[1]);

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
        if (!quote || quote.lte(0)) {
          logger.debug(
            `Dropping a null quote ${amount.toString()} for routing path in ${
              route.protocol
            }.`
          );
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

    if (allRoutesWithValidQuotes.length == 0) {
      logger.info(`Received no valid quotes`);
      return undefined;
    }

    // logger.debug(`${routeAmountsToString(allRoutesWithValidQuotes)}`);

    // get best route
    const swapRoutes = getBestSwapRoute(
      amount,
      percents,
      allRoutesWithValidQuotes,
      tradeType,
      routingConfig
    );
    if (!swapRoutes) {
      logger.error(`Could not find route.`);
      return undefined;
    }
    const { quoteAdjustedForGas, quote, routes: routeAmounts } = swapRoutes;

    // print swapRoute
    logger.info(
      `Best Route for (${tokenIn.symbol}=>${tokenOut.symbol}) when the block number is ${blockNumber}`
    );
    logger.info(`${routeAmountsToString(routeAmounts)}`);
    logger.info(`\tRaw Quote Exact In:`);
    logger.info(`\t\t${quote.amount.toString()}`);
    logger.info(`\tGas Adjusted Quote In:`);
    logger.info(`\t\t${quoteAdjustedForGas.amount.toString()}`);

    return swapRoutes;
  }
}
