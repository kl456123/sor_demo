import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { globalBlacklist } from '../src/blacklist';
import { Database } from '../src/database';
import { DexAggregator } from '../src/dex_aggregator';
import { TokenAmount } from '../src/entities';
import { logger } from '../src/logging';
import { ChainId, TradeType } from '../src/types';
import { loadFixture } from '../test/utils/fixture';
import { IERC20, IERC20__factory } from '../typechain-types';

dotenv.config();

async function main() {
  const chainId = ChainId.MAINNET;
  const nodeUrl = process.env.MAINNET_URL as string;
  const tokens = TOKENS[chainId];

  const fixture = await loadFixture(tokens.WETH.address);
  const transformerAddr = fixture.fillQuoteTransformer.address;
  const swapperAddress = fixture.swapper.address;
  const deployer = fixture.deployer;
  const deployerAddr = fixture.deployer.address;
  const testUrl = fixture.provider;
  // init database first
  const database = new Database(process.env.DB_CONN_STRING as string);
  await database.initDB(process.env.DB_NAME as string);

  const dexAggregator = new DexAggregator({
    chainId,
    nodeUrl,
    testUrl,
    transformerAddr,
    database,
  });

  // trade params
  const baseToken = tokens.WETH;
  const quoteToken = tokens.USDC;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('1000', baseToken.decimals)
  );

  const inputToken: IERC20 = IERC20__factory.connect(
    baseToken.address,
    deployer
  );
  const outputToken: IERC20 = IERC20__factory.connect(
    quoteToken.address,
    deployer
  );
  // approve first
  const max = ethers.constants.MaxUint256;
  await inputToken.approve(swapperAddress, max);

  const before = await outputToken.balanceOf(deployerAddr);

  const swapRoute = await dexAggregator.quote({
    amount,
    quoteToken,
    tradeType,
  });
  if (!swapRoute) {
    return;
  }

  const blockNumberForQuote = swapRoute.blockNumber;
  const blockNumberForSwap = fixture.blockNumber;
  if (swapRoute.calldata) {
    const tx = await dexAggregator.swap(
      swapperAddress,
      swapRoute.calldata,
      deployerAddr
    );
    console.log('gasLimit: ', tx.gasLimit);
    console.log('gasPrice: ', tx.gasPrice);
    const gasPriceProd = await dexAggregator.getGasPrice(false);
    console.log('gasPriceProd: ', gasPriceProd);
  }

  const after = await outputToken.balanceOf(deployerAddr);
  let actualVal = after.sub(before);
  if (inputToken.address === outputToken.address) {
    actualVal = actualVal.add(amount.amount);
  }
  const expectVal = swapRoute.routeWithQuote.quote.amount;
  logger.info(
    `[blocknumber: ${blockNumberForSwap}]swap: ${actualVal.toString()}`
  );
  logger.info(
    `[blocknumber: ${blockNumberForQuote}]quote: ${expectVal.toString()}`
  );
  const error = actualVal.sub(expectVal).mul(10000).div(expectVal);
  // ten thousand percent(0.0001%)
  logger.info(`error: ${error.toNumber() / 100}%`);

  // update blacklist
  const blacklistPools = Array.from(globalBlacklist());
  logger.info(`num of pools in blacklist: ${blacklistPools.length}`);
  fs.writeFileSync(
    path.resolve(__dirname, '../data/blacklist.json'),
    JSON.stringify(blacklistPools)
  );

  await database.close();
}

main().catch(console.error);
