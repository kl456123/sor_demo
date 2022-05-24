import axios from 'axios';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { logger } from '../src/logging';
import { BINANCE7 } from '../src/simulator';
import {
  ChainId,
  QuoteParam,
  QuoteResponse,
  SwapParam,
  SwapResponse,
} from '../src/types';

dotenv.config();

async function quote(queryParam: QuoteParam) {
  const url = `http://${process.env.SERVER_IP}:${process.env.SERVER_PORT}/quote`;
  const res = await axios.get(url, { params: queryParam });
  const quoteRes = res.data as QuoteResponse;
  return quoteRes;
}

async function swap(swapParam: SwapParam) {
  const url = `http://${process.env.SERVER_IP}:${process.env.SERVER_PORT}/swap`;
  const res = await axios.get(url, { params: swapParam });
  const swapRes = res.data as SwapResponse;
  return swapRes;
}

async function main() {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId];
  const provider = new ethers.providers.JsonRpcProvider(
    'http://35.75.165.133:8547'
  );
  const amount = ethers.utils.parseUnits('100000000', 6).toString();
  const fromTokenAddress = tokens.USDC.address;
  const toTokenAddress = tokens.USDT.address;
  const queryParam: QuoteParam = {
    fromTokenAddress,
    toTokenAddress,
    amount,
  };
  const timeBefore = Date.now();
  const quoteRes = await quote(queryParam);
  console.log(quoteRes);
  logger.info(`latencyMs: ${Date.now() - timeBefore}`);

  // swap
  const fromAddress = BINANCE7;
  const slippage = '0';
  const ethValue = '0';
  const swapParam: SwapParam = {
  amount,
  fromTokenAddress,
  toTokenAddress,
  fromAddress,
  slippage,
  };
  const timeBefore1 = Date.now();
  const swapRes = await swap(swapParam);
  console.log(swapRes);
  logger.info(`latencyMs: ${Date.now() - timeBefore1}`);
  // // send tx
  // // prepare tokens first
  // await prepareTokens(
  // fromAddress,
  // fromTokenAddress,
  // amount,
  // ethValue,
  // provider
  // );

  // // approve dexRouter for input token
  // const max = ethers.constants.MaxUint256;
  // const signer = await impersonateAccount(fromAddress, provider);
  // const inputTokenContract = IERC20__factory.connect(fromTokenAddress, signer);
  // const outputTokenContract = IERC20__factory.connect(toTokenAddress, signer);
  // await inputTokenContract.approve(swapRes.to, max);

  // // check output token balance before and after
  // const before = await outputTokenContract.balanceOf(fromAddress);
  // const tx = {
  // from: swapRes.from,
  // to: swapRes.to,
  // value: BigNumber.from(swapRes.value),
  // data: swapRes.data,
  // // gasLimit: BigNumber.from(swapRes.gasLimit),
  // gasPrice: BigNumber.from(swapRes.gasPrice),
  // };
  // await signer.sendTransaction(tx);
  // const after = await outputTokenContract.balanceOf(fromAddress);
  // const outputAmount = after.sub(before);
  // console.log(outputAmount.toString());
}

main().catch(console.error);
