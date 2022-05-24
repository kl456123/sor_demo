import { BigNumberish, ethers } from 'ethers';

import { SwapRouteV2 } from './best_swap_route';
import { Database } from './database';
import { AlphaRouter, IRouter } from './router';
import { ChainId, Protocol, TradeType } from './types';

type TradeParams = {
  amount: BigNumberish;
  fromTokenAddress: string;
  toTokenAddress: string;
  tradeType: TradeType;
};

type DexAggregatorParams = {
  chainId: ChainId;
  nodeUrl: string | ethers.providers.JsonRpcProvider;
  testUrl?: string | ethers.providers.JsonRpcProvider;
  transformerAddr?: string;
  database: Database;
};

export class DexAggregator {
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly testProvider: ethers.providers.JsonRpcProvider;
  private readonly router: IRouter;
  public readonly chainId: ChainId;
  constructor({
    chainId,
    nodeUrl,
    testUrl,
    transformerAddr,
    database,
  }: DexAggregatorParams) {
    if (typeof nodeUrl === 'string') {
      this.provider = new ethers.providers.JsonRpcProvider({
        url: nodeUrl,
      });
    } else {
      this.provider = nodeUrl;
    }
    testUrl = testUrl || 'http://localhost:8545';
    if (typeof testUrl === 'string') {
      this.testProvider = new ethers.providers.JsonRpcProvider({
        url: testUrl,
      });
    } else {
      this.testProvider = testUrl;
    }
    this.chainId = chainId;
    transformerAddr = transformerAddr || ethers.constants.AddressZero;
    this.router = new AlphaRouter({
      provider: this.provider,
      chainId: this.chainId,
      transformerAddr,
      database,
    });
  }

  public async quote({
    amount,
    fromTokenAddress,
    toTokenAddress,
    tradeType,
  }: TradeParams): Promise<SwapRouteV2 | undefined> {
    const swapRoute = await this.router.route(
      amount,
      fromTokenAddress,
      toTokenAddress,
      tradeType,
      {
        // tx calldata is too large to send
        maxSwapsPerPath: 2,
        includedSources: [
          Protocol.UniswapV2,
          Protocol.UniswapV3,
          Protocol.Curve,
          Protocol.CurveV2,
          Protocol.Balancer,
          Protocol.BalancerV2,
          Protocol.DODOV2,
          Protocol.DODO,
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
      }
    );
    return swapRoute;
  }

  public async swap(
    swapperAddress: string,
    calldata: string,
    signerAddr?: string,
    test = true
  ) {
    const provider = test ? this.testProvider : this.provider;
    const signer = provider.getSigner(signerAddr || 0);
    const from = await signer.getAddress();
    const tx = {
      from,
      to: swapperAddress,
      data: calldata,
      value: 0,
    };
    const gasLimit = await provider.estimateGas(tx);
    const gasPrice = await provider.getGasPrice();
    return await signer.sendTransaction({ ...tx, gasLimit, gasPrice });
  }

  public async getGasPrice(test: boolean) {
    if (test) {
      return this.testProvider.getGasPrice();
    }
    return this.provider.getGasPrice();
  }
}
