import fs from 'fs';
import path from 'path';

import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from './base_token';
import { SwapRouteV2 } from './best_swap_route';
import { globalBlacklist } from './blacklist';
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

const nodeUrl = process.env.MAINNET_URL!;

class TestSuite {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly router: IRouter;
  constructor(public readonly chainId: ChainId) {
    // this.provider = ethers.providers.getDefaultProvider('mainnet');
    this.provider = new ethers.providers.JsonRpcProvider({
      url: nodeUrl,
      timeout: 40000,
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
        Protocol.UniswapV3,
        Protocol.UniswapV2,
        Protocol.DODO,
        Protocol.DODOV2,
        Protocol.Balancer,
        Protocol.BalancerV2,
        Protocol.Curve,
        // Protocol.CurveV2,
      ],
      maxSplits: 6,
      poolSelections: {
        topN: 10,
        topNSecondHop: 6,
        topNTokenInOut: 8,
        topNDirectSwaps: 1,
        topNWithEachBaseToken: 2,
        topNWithBaseToken: 5,
        topNWithBaseTokenInSet: true,
      },
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
  const quoteToken = tokens.USDT;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('10000', baseToken.decimals)
  );

  const swapRoute = await testSuite.quote({ amount, quoteToken, tradeType });
  if (!swapRoute) {
    return;
  }

  // update blacklist
  const blacklistPools = Array.from(globalBlacklist());
  logging
    .getGlobalLogger()
    .info(`num of pools in blacklist: ${blacklistPools.length}`);
  fs.writeFileSync(
    path.resolve(__dirname, '../data/blacklist.json'),
    JSON.stringify(blacklistPools)
  );
}

main().catch(console.error);
