import Router from '@koa/router';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import Koa from 'koa';

import deploymentsJSON from '../deployments/deployments.json';
import { Database } from '../src/database';
import { DexAggregator } from '../src/dex_aggregator';
import { Token, TokenAmount } from '../src/entities';
import { logger } from '../src/logging';
import {
  ChainId,
  QuoteParam,
  QuoteResponse,
  SwapParam,
  SwapResponse,
  TradeType,
} from '../src/types';
import { multiplexRouteQToString } from '../src/utils';

import { DeploymentsAddress } from './deploy';

dotenv.config();

async function getApp() {
  const router = new Router();

  const chainId = ChainId.MAINNET;
  const nodeUrl = process.env.MAINNET_URL as string;
  const tradeType = TradeType.EXACT_INPUT;
  const deployments = (deploymentsJSON as DeploymentsAddress)[chainId];
  const swapperAddress = deployments.swapper;
  const transformerAddr = deployments.fillQuoteTransformer;

  const database = new Database(process.env.DB_CONN_STRING as string);
  await database.initDB(process.env.DB_NAME as string);

  const provider = new ethers.providers.JsonRpcProvider({
    url: nodeUrl,
  });

  const dexAggregator = new DexAggregator({
    chainId,
    nodeUrl: provider,
    database,
    transformerAddr,
  });

  // quote api
  router.get('/quote', async ctx => {
    const query = ctx.query as unknown as QuoteParam;
    logger.info(`query: ${JSON.stringify(query)}`);
    const baseToken = new Token({
      chainId,
      address: query.fromTokenAddress as string,
      decimals: 0,
    });
    const quoteToken = new Token({
      chainId,
      address: query.toTokenAddress as string,
      decimals: 0,
    });
    const amount = new TokenAmount(baseToken, query.amount as string);
    const swapRoute = await dexAggregator.quote({
      amount,
      quoteToken,
      tradeType,
    });
    if (!swapRoute) {
      throw new Error(`any route is not found`);
    }
    ctx.status = 200;
    const quoteRes: QuoteResponse = {
      fromToken: baseToken.address,
      toToken: quoteToken.address,
      fromTokenAmount: amount.amount.toString(),
      toTokenAmount: swapRoute.routeWithQuote.quote.amount.toString(),
      protocols: multiplexRouteQToString(swapRoute.routeWithQuote),
    };
    ctx.body = quoteRes;
  });

  // swap api
  router.get('/swap', async ctx => {
    const query = ctx.query as unknown as SwapParam;
    logger.info(`query: ${JSON.stringify(query)}`);
    const baseToken = new Token({
      chainId,
      address: query.fromTokenAddress as string,
      decimals: 0,
    });
    const quoteToken = new Token({
      chainId,
      address: query.toTokenAddress as string,
      decimals: 0,
    });
    const amount = new TokenAmount(baseToken, query.amount as string);
    const swapRoute = await dexAggregator.quote({
      amount,
      quoteToken,
      tradeType,
    });
    if (!swapRoute) {
      throw new Error(`any route is not found`);
    }
    ctx.status = 200;
    const from = query.fromAddress as string;
    const to = swapperAddress;

    const data = swapRoute.calldata as string;
    const gasLimit = (
      await provider.estimateGas({ from, to, data })
    ).toString();
    const gasPrice = (await provider.getGasPrice()).toString();
    const quoteRes: SwapResponse = {
      fromToken: baseToken.address,
      toToken: quoteToken.address,
      fromTokenAmount: amount.amount.toString(),
      toTokenAmount: swapRoute.routeWithQuote.quote.amount.toString(),
      data,
      value: '0',
      gasPrice,
      gasLimit,
      from,
      to,
    };
    ctx.body = quoteRes;
  });

  const app = new Koa();

  app.use(router.routes());
  return app;
}

async function main() {
  const app = await getApp();
  const port = parseInt(process.env.SERVER_PORT as string);
  const ip = process.env.SERVER_IP as string;
  logger.info(`server is listening at ${ip}:${port}`);
  app.listen(port, ip);
}

main().catch(console.error);
