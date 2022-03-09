import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from './base_token';
import { SwapRouteV2 } from './best_swap_route';
import { Token, TokenAmount } from './entities';
import logging from './logging';
import { AlphaRouter, IRouter } from './router';
import { ChainId, Protocol, TradeType } from './types';

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
// const nodeUrl =
// 'https://eth-mainnet.alchemyapi.io/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03';
const nodeUrl = 'http://127.0.0.1:8545';

class TestSuite {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly router: IRouter;
  constructor(public readonly chainId: ChainId) {
    // this.provider = ethers.providers.getDefaultProvider('mainnet');
    this.provider = new ethers.providers.JsonRpcProvider({
      url: nodeUrl,
      timeout: 400000,
    });
    this.router = new AlphaRouter({
      provider: this.provider,
      chainId: this.chainId,
    });
  }

  public async quote({
    amount,
    quoteToken,
    tradeType,
  }: TradeParams): Promise<SwapRouteV2 | undefined> {
    const swapRoute = await this.router.route(amount, quoteToken, tradeType, {
      // tx calldata is too large to send
      maxSwapsPerPath: 2,
      includedSources: [
        Protocol.UniswapV2,
        // Protocol.BalancerV2,
        Protocol.UniswapV3,
        Protocol.Curve,
      ],
      maxSplits: 4,
    });
    return swapRoute;
  }
}

async function main() {
  const chainId = ChainId.MAINNET;
  const testSuite = new TestSuite(chainId);

  // trade params
  const tokens = TOKENS[chainId]!;
  const baseToken = tokens.WETH;
  const quoteToken = tokens.USDC;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('1000', baseToken.decimals)
  );

  const swapRoute = await testSuite.quote({ amount, quoteToken, tradeType });
  if (!swapRoute) {
    return;
  }
}

main().catch(console.error);
