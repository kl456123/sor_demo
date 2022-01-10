import { orderCalculationUtils } from '@0x/order-utils';
import { BigNumber } from 'bignumber.js';
import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import _ from 'lodash';

import { TOKENS } from './base_token';
import { Token, TokenAmount } from './entities';
import logging from './logging';
import { Orderbook, sortOrders } from './markets/orderbook';
import { AlphaRouter, IRouter } from './router';
import { DexSample, Sampler } from './sampler';
import {
  ISubgraphPoolProvider,
  SubgraphPoolProvider,
} from './subgraph_provider';
import {
  ChainId,
  Protocol,
  ProviderConfig,
  SwapRoute,
  TradeType,
} from './types';
import { UniswapV2Router02, UniswapV2Router02__factory } from './types/v2';
import { IQuoterV2, QuoterV2__factory } from './types/v3';

dotenv.config();

// ether global logger
ethers.utils.Logger.globalLogger();
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.DEBUG);

// custom global logger
const logger = bunyan.createLogger({
  name: 'Smart Order Router',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
});
logging.setGlobalLogger(logger);

type TradeParams = {
  amount: TokenAmount;
  quoteToken: Token;
  tradeType: TradeType;
};
const UNISWAP_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNISWAP_MULTICALL_ADDRESS = '0x1F98415757620B543A52E61c46B32eB19261F984';
const ORDERBOOK_URL = 'https://api.0x.org/sra';

class TestSuite {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly router: IRouter;
  private readonly sampler: Sampler;
  private readonly subgraphPoolProvider: ISubgraphPoolProvider;
  public readonly uniswapRouter02: UniswapV2Router02;
  public readonly orderbook: Orderbook;
  public readonly quoterv2: IQuoterV2;
  constructor(public readonly chainId: ChainId) {
    this.provider = ethers.providers.getDefaultProvider('mainnet');
    this.router = new AlphaRouter({
      provider: this.provider,
      chainId: this.chainId,
    });
    this.sampler = new Sampler(this.chainId, this.provider, {});
    this.subgraphPoolProvider = new SubgraphPoolProvider(this.chainId);
    // uniswap router used to calculate slippage
    this.uniswapRouter02 = UniswapV2Router02__factory.connect(
      UNISWAP_ROUTER_ADDRESS,
      this.provider
    );

    this.orderbook = new Orderbook(ORDERBOOK_URL);
    this.quoterv2 = QuoterV2__factory.connect(
      UNISWAP_MULTICALL_ADDRESS,
      this.provider
    );
  }

  public async quote({
    amount,
    quoteToken,
    tradeType,
  }: TradeParams): Promise<SwapRoute | undefined> {
    const swapRoute = await this.router.route(amount, quoteToken, tradeType, {
      minSplits: 1,
      // excludedSources: [Protocol.UniswapV2]
    });
    return swapRoute;
  }

  public async sample({
    amount,
    quoteToken,
    tradeType,
  }: TradeParams): Promise<DexSample[][]> {
    const tradedTokens =
      tradeType == TradeType.EXACT_INPUT
        ? [amount.token, quoteToken]
        : [quoteToken, amount.token];
    const path = tradedTokens.map(token => token.address);
    const fillAmounts = [amount.amount];
    // TODO(adapt route path to cross protocols instead of routing in single protocol)
    const samplerRoutes = [
      { protocol: Protocol.UniswapV2, path },
      { protocol: Protocol.Eth2Dai, path },
    ];
    const [dexQuotes] = await this.sampler.executeAsync(
      this.sampler.getSellQuotes(fillAmounts, samplerRoutes)
    );
    return dexQuotes;
  }

  public async getPools() {
    const curBlockNumber = await this.provider.getBlockNumber();
    const delay = 10;
    const blockNumber = curBlockNumber - delay;
    const providerConfig: ProviderConfig = { blockNumber };

    const now = Date.now();
    const rawPools = await this.subgraphPoolProvider.getPools(
      undefined,
      undefined,
      providerConfig
    );

    const deltaTime = Date.now() - now;
    logging.getGlobalLogger().info(deltaTime);
    logging.getGlobalLogger().info(rawPools.length);
  }
  public async getQuoteFromOrderbook({
    amount,
    quoteToken,
    tradeType,
  }: TradeParams) {
    const takerTokenAddress =
      tradeType == TradeType.EXACT_INPUT
        ? amount.token.address
        : quoteToken.address;
    const makerTokenAddress =
      tradeType == TradeType.EXACT_INPUT
        ? quoteToken.address
        : amount.token.address;
    // const makerAssetData =
    // assetDataUtils.encodeERC20AssetData(makerTokenAddress);
    // const takerAssetData =
    // assetDataUtils.encodeERC20AssetData(takerTokenAddress);
    const orders = await this.orderbook.getOrdersAsync(
      makerTokenAddress,
      takerTokenAddress
    );

    // get fillable amouts from on-chain data
    const quoteFn =
      tradeType == TradeType.EXACT_INPUT
        ? this.sampler.getOrderFillableTakerAssetAmounts.bind(this.sampler)
        : this.sampler.getOrderFillableMakerAssetAmounts.bind(this.sampler);
    const [orderFillableAmounts] = await this.sampler.executeAsync(
      quoteFn(orders)
    );

    const orderwithfillableAmounts = _.map(orders, (order, i) => {
      // use BigNumber from bignumber.js for 0x orderbook
      const orderFillableAmount = new BigNumber(
        orderFillableAmounts[i].toString()
      );
      const fillableTakerAssetAmount =
        tradeType == TradeType.EXACT_INPUT
          ? orderFillableAmount
          : orderCalculationUtils.getTakerFillAmount(
              order,
              orderFillableAmount
            );
      const fillableMakerAssetAmount =
        tradeType == TradeType.EXACT_OUTPUT
          ? orderFillableAmount
          : orderCalculationUtils.getMakerFillAmount(
              order,
              orderFillableAmount
            );
      // fee for taker only
      const fillableTakerFeeAmount = orderCalculationUtils.getTakerFeeAmount(
        order,
        fillableTakerAssetAmount
      );

      return {
        ...order,
        fillableMakerAssetAmount,
        fillableTakerAssetAmount,
        fillableTakerFeeAmount,
      };
    });

    return sortOrders(
      orderwithfillableAmounts,
      tradeType === TradeType.EXACT_OUTPUT
    );
  }

  public async getQuotesForUniswapV3() {
    this.quoterv2.callStatic.quoteExactInput;
  }
}

async function main() {
  const chainId = ChainId.MAINNET;
  const testSuite = new TestSuite(chainId);

  // trade params
  const tokens = TOKENS[chainId]!;
  const baseToken = tokens.USDC;
  const quoteToken = tokens.DAI;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('10000000', baseToken.decimals)
  );
  logger.info(`Swap ${amount} for ${quoteToken.symbol}`);

  const swapRoute = await testSuite.quote({ amount, quoteToken, tradeType });
  if (!swapRoute) {
    return;
  }
  const dexQuotes = await testSuite.sample({ amount, quoteToken, tradeType });
  const quote0 = swapRoute.quoteAdjustedForGas.amount;
  // find the best single route path from all routes
  const quote1 = dexQuotes
    .map(dexQuote => dexQuote[0])
    .reduce((res, quote) => {
      return res.output.gt(quote.output) ? res : quote;
    }).output;
  const diff = quote0.sub(quote1);
  logger.info(`quote for route: ${quote0.toString()}`);
  logger.info(`quote for no route: ${quote1.toString()}`);
  logger.info(
    `saved cost: ${diff.toString()}=${
      diff.mul(10000).div(quote1).toNumber() / 100
    }%`
  );

  // const orders = await testSuite.getQuoteFromOrderbook({
  // amount,
  // quoteToken,
  // tradeType,
  // });
  // logger.info(`${orders.length}`);
  // // logger.info(`${orders[0].fillableMakerAssetAmount.toString()}`);
  // console.log(orders[0]);
}

main().catch(console.error);
