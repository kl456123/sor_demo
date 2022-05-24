import { BigNumberish, providers } from 'ethers';
import _ from 'lodash';

import { Database } from '../src/database';

import {
  computeAllRoutes,
  getAmountDistribution,
  getCandidatePools,
} from './algorithm';
import { getBestSwapRouteV2, SwapRouteV2 } from './best_swap_route';
import { Composer } from './composer';
import { DEFAULT_ROUTER_CONFIG } from './constants';
import { TokenAmount } from './entities';
import { GasModelFactory } from './gas-model';
import {
  ETHGasStationGasPriceProvider,
  IGasPriceProvider,
} from './gasprice-provider';
import { logger } from './logging';
import { QuoteConsumer } from './quote_consumer';
import { QuoterProvider } from './quoter_provider';
import { RawPoolProvider } from './rawpool_provider';
import { ChainId, RoutingConfig, TradeType } from './types';

export abstract class IRouter {
  abstract route(
    inputAmount: BigNumberish,
    fromTokenAddress: string,
    toTokenAddress: string,
    tradeType: TradeType,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRouteV2 | undefined>;
}

export type AlphaRouterParams = {
  chainId: ChainId;
  provider: providers.BaseProvider;
  database: Database;
  transformerAddr: string;
};

const ETH_GAS_STATION_API_URL = 'https://ethgasstation.info/api/ethgasAPI.json';

export class AlphaRouter implements IRouter {
  protected chainId: ChainId;
  protected provider: providers.BaseProvider;
  protected quoterProvider: QuoterProvider;
  protected poolProvider: RawPoolProvider;
  protected quoteConsumer: QuoteConsumer;
  protected gasPriceProvider: IGasPriceProvider;
  constructor({
    chainId,
    provider,
    transformerAddr,
    database,
  }: AlphaRouterParams) {
    this.chainId = chainId;
    // node provider
    this.provider = provider;

    // data provider
    this.poolProvider = new RawPoolProvider(this.chainId, database);
    this.quoterProvider = new QuoterProvider(
      chainId,
      provider,
      this.poolProvider
    );
    this.quoteConsumer = new QuoteConsumer(
      this.chainId,
      this.provider,
      transformerAddr
    );
    this.gasPriceProvider = new ETHGasStationGasPriceProvider(
      ETH_GAS_STATION_API_URL
    );
  }

  public async route(
    inputAmount: BigNumberish,
    fromTokenAddress: string,
    toTokenAddress: string,
    tradeType: TradeType,
    partialRoutingConfig: Partial<RoutingConfig> = {}
  ): Promise<SwapRouteV2 | undefined> {
    const blockNumber =
      partialRoutingConfig.blockNumber ??
      (await this.provider.getBlockNumber());
    const routingConfig: RoutingConfig = _.merge(
      {},
      DEFAULT_ROUTER_CONFIG,
      partialRoutingConfig,
      { blockNumber }
    );
    const tokens = await this.poolProvider.getTokens();

    const baseToken = tokens[fromTokenAddress.toLowerCase()];
    const quoteToken = tokens[toTokenAddress.toLowerCase()];
    const amount = new TokenAmount(baseToken, inputAmount);

    // log configs
    logger.info(`routing config: ${JSON.stringify(routingConfig, null, 2)}`);

    const { firstDistributionPercent, secondDistributionPercent } =
      routingConfig;
    const [firstPercents] = getAmountDistribution(
      amount,
      firstDistributionPercent
    );

    const [secondPercents] = getAmountDistribution(
      amount,
      secondDistributionPercent
    );

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
      rawPoolProvider: this.poolProvider,
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

    const composedRoutes = Composer.compose(routes);

    const timeBefore = Date.now();
    const gasPriceWei = await this.provider.getGasPrice();
    const gasModelFactory = new GasModelFactory(
      this.chainId,
      this.provider,
      this.poolProvider,
      gasPriceWei
    );
    // get best route
    const swapRoutes = await getBestSwapRouteV2(
      amount,
      firstPercents,
      secondPercents,
      composedRoutes,
      tradeType,
      routingConfig,
      gasModelFactory,
      this.quoterProvider
    );
    const latencyMs = Date.now() - timeBefore;
    logger.info(`latencyMs for getBestSwapRouteV2: ${latencyMs} ms`);

    if (!swapRoutes) {
      logger.error(`Could not find route.`);
      return undefined;
    }
    const { routeWithQuote } = swapRoutes;
    swapRoutes.calldata =
      this.quoteConsumer.encodeBatchSellRoute(routeWithQuote);

    // print swapRoute
    // logger.info(`Swap ${amount} for ${quoteToken.symbol}`);
    // logger.info(
    // `Best Route for (${tokenIn.symbol}=>${tokenOut.symbol}) when the block number is ${blockNumber}`
    // );
    // logger.info(`${multiplexRouteQToString(routeWithQuote)}`);
    // logger.info(`\tRaw Quote Exact In:`);
    // logger.info(`\t\t${routeWithQuote.quote.amount.toString()}`);
    // logger.info(`\tGas Adjusted Quote In:`);
    // logger.info(`\t\t${routeWithQuote.quoteAdjustedForGas.amount.toString()}`);
    // logger.info(`calldata: ${swapRoutes.calldata}`);

    return swapRoutes;
  }
}
