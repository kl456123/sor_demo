import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { BigNumber, ethers } from 'ethers';
import { contractAddressesByChain } from './addresses';
import { TOKENS } from './base_token';
import { TokenAmount } from './entities';
import logging from './logging';
import { AlphaRouter } from './router';
import { Sampler } from './sampler';
import { SubgraphPoolProvider } from './subgraph_provider';
import {
  ChainId,
  Protocol,
  ProviderConfig,
  SwapRoute,
  TradeType,
} from './types';
import { Erc20BridgeSampler__factory } from './types/other';

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
  // const recipient = '0x';
  const tradeType = TradeType.EXACT_INPUT;
  const swapRouters = await router.route(amount, quoteToken, tradeType);
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

async function sample() {
  const provider = ethers.getDefaultProvider('mainnet');
  const sampler = new Sampler(ChainId.MAINNET, provider, {});
  const tokens = TOKENS[ChainId.MAINNET]!;
  const path = [tokens.USDC.address, tokens.WETH.address];
  const fillAmounts = [
    ethers.utils.parseUnits('2000', 6),
    ethers.utils.parseUnits('4000', 6),
  ];
  const samplerRoutes = [
    { protocol: Protocol.UniswapV2, path },
    { protocol: Protocol.SushiSwap, path },
  ];
  const [dexQuotes] = await sampler.executeAsync(
    sampler.getSellQuotes(fillAmounts, samplerRoutes)
  );
  console.log(dexQuotes);
}

async function samplerContract() {
  const provider = ethers.getDefaultProvider('mainnet');
  const samplerAddress = contractAddressesByChain[ChainId.MAINNET]!.quoter;
  const samplerContract = Erc20BridgeSampler__factory.connect(
    samplerAddress,
    provider
  );
  const tokens = TOKENS[ChainId.MAINNET]!;
  const path = [tokens.USDC.address, tokens.WETH.address];
  const fillAmounts = [
    ethers.utils.parseUnits('2000', 6),
    ethers.utils.parseUnits('4000', 6),
  ];
  const quotes = await samplerContract.sampleSellsFromUniswapV2(
    path,
    fillAmounts
  );
  console.log(quotes);
}

async function main() {
  getPools;
  quote;
  sample;
  samplerContract;
  // await getPools();
  // await quote();
  await sample();
  // samplerContract();
}

main().catch(console.error);
