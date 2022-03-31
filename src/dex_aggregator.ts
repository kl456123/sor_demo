import { ethers } from 'ethers';

import { SwapRouteV2 } from './best_swap_route';
import { Token, TokenAmount } from './entities';
import { AlphaRouter, IRouter } from './router';
import { ChainId, Protocol, TradeType } from './types';

type TradeParams = {
  amount: TokenAmount;
  quoteToken: Token;
  tradeType: TradeType;
};

type DexAggregatorParams = {
  chainId: ChainId;
  nodeUrl: string | ethers.providers.BaseProvider;
  testUrl?: string | ethers.providers.JsonRpcProvider;
  transformerAddr?: string;
};

export class DexAggregator {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly testProvider: ethers.providers.JsonRpcProvider;
  private readonly router: IRouter;
  public readonly chainId: ChainId;
  constructor({
    chainId,
    nodeUrl,
    testUrl,
    transformerAddr,
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
        Protocol.Curve,
        Protocol.CurveV2,
        Protocol.BalancerV2,
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

  public async swap(
    swapperAddress: string,
    calldata: string,
    signerAddr?: string
  ) {
    const signer = this.testProvider.getSigner(signerAddr || 0);
    const from = await signer.getAddress();
    const tx = {
      from,
      to: swapperAddress,
      data: calldata,
      value: 0,
    };
    await signer.sendTransaction(tx);
  }
}
