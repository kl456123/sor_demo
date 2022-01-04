import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { BigNumber, ethers } from 'ethers';

import { TOKENS } from './base_token';
import { TokenAmount } from './entities';
import logging from './logging';
import { AlphaRouter } from './router';
import { SubgraphPoolProvider } from './subgraph_provider';
import { ChainId, ProviderConfig, SwapRoute, TradeType } from './types';

// async function quote(tokenIn: Token, tokenOut: Token) {
// tokenIn;
// tokenOut;
// }

// async function swap(tokenIn: Token, tokenOut: Token) {
// tokenIn;
// tokenOut;
// }

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

async function quote(): Promise<SwapRoute | undefined> {
  const chainId = ChainId.MAINNET;
  const rpcUrl = process.env.JSON_RPC_PROVIDER!;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const router = new AlphaRouter({ provider, chainId });

  const tokens = TOKENS[chainId]!;
  const baseToken = tokens.DAI;
  const quoteToken = tokens.WETH;
  // find the best route for quote
  const amount = new TokenAmount(baseToken, BigNumber.from('1000'));
  const recipient = '0x';
  const tradeType = TradeType.EXACT_INPUT;
  const swapRouters = await router.route(
    amount,
    quoteToken,
    tradeType,
    recipient
      ? { deadline: 100, recipient, slippageTolerance: 0.00005 }
      : undefined
  );
  return swapRouters;
}

async function getPools() {
  const provider = ethers.getDefaultProvider('mainnet');
  const curBlockNumber = await provider.getBlockNumber();
  const delay = 10;
  const blockNumber = curBlockNumber - delay;
  const subgraphPoolProvider = new SubgraphPoolProvider(ChainId.MAINNET);
  const providerConfig: ProviderConfig = { blockNumber };

  const now = Date.now();
  const rawPools = await subgraphPoolProvider.getPools(
    undefined,
    undefined,
    providerConfig
  );

  const deltaTime = Date.now() - now;
  logging.getGlobalLogger().info(deltaTime);
  logging.getGlobalLogger().info(rawPools.length);
}

async function main() {
  await quote();
}

main().catch(logging.getGlobalLogger().error);
