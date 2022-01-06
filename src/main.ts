import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from './base_token';
import { Token, TokenAmount } from './entities';
import logging from './logging';
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

class TestSuite {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly router: IRouter;
  private readonly sampler: Sampler;
  private readonly subgraphPoolProvider: ISubgraphPoolProvider;
  public readonly uniswapRouter02: UniswapV2Router02;
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
}

async function main() {
  const chainId = ChainId.MAINNET;
  const testSuite = new TestSuite(chainId);

  // trade params
  const tokens = TOKENS[chainId]!;
  const baseToken = tokens.WETH;
  const quoteToken = tokens.DAI;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('1000', baseToken.decimals)
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

  // slippage
}

main().catch(console.error);
