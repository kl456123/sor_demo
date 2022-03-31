import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from './base_token';
import { globalBlacklist } from './blacklist';
import { DexAggregator } from './dex_aggregator';
import { TokenAmount } from './entities';
import logging from './logging';
import { ChainId, TradeType } from './types';

dotenv.config();

async function main() {
  const chainId = ChainId.MAINNET;
  const nodeUrl = process.env.MAINNET_URL!;
  const dexAggregator = new DexAggregator({ chainId, nodeUrl });

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

  const swapRoute = await dexAggregator.quote({
    amount,
    quoteToken,
    tradeType,
  });
  if (!swapRoute) {
    return;
  }
  // if (swapRoute.calldata) {
  // const swapperAddress = '0xe1fd27f4390dcbe165f4d60dbf821e4b9bb02ded';
  // await dexAggregator.swap(swapperAddress, swapRoute.calldata);
  // }

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
