// wrapper for erc20 bridge sampler contract

import { SignedOrder } from '@0x/types';
import { Interface } from '@ethersproject/abi';
import { BigNumber, providers } from 'ethers';
import _ from 'lodash';
import invariant from 'tiny-invariant';

import { contractAddressesByChain } from './addresses';
// import { Route, TokenAmount } from './entities';
import { logger } from './logging';
import { getCurveInfosForPool } from './markets/curve';
import { ChainId, Protocol } from './types';
import { Erc20BridgeSampler, Erc20BridgeSampler__factory } from './types/other';

export interface ContractOperation<TResult> {
  encodeCall(): string;
  handleCallResults(callResults: string): TResult;
  handleRevert(callResults: string): TResult;
}

export interface SourceContractOperation
  extends ContractOperation<BigNumber[]> {
  readonly protocol: Protocol;
}

export interface SamplerRoute {
  protocol: Protocol;
  poolAddress?: string;
  path: string[];
}

export interface DexSample {
  protocol: Protocol;
  input: BigNumber;
  output: BigNumber;
}

export type SamplerContractOption<TFunctionParams> = {
  protocol: Protocol;
  contractInterface: Interface;
  functionName: string;
  functionParams?: TFunctionParams;
};

export class SamplerContractOperation<TFunctionParams extends any[] | undefined>
  implements SourceContractOperation
{
  private readonly functionName: string;
  private readonly functionParams?: TFunctionParams;
  private readonly contractInterface: Interface;
  public readonly protocol: Protocol;
  constructor(options: SamplerContractOption<TFunctionParams>) {
    this.functionName = options.functionName;
    this.functionParams = options.functionParams;
    this.contractInterface = options.contractInterface;
    this.protocol = options.protocol;
  }

  public encodeCall(): string {
    const fragment = this.contractInterface.getFunction(this.functionName);
    const calldata = this.contractInterface.encodeFunctionData(
      fragment,
      this.functionParams
    );
    return calldata;
  }

  public handleCallResults(callResults: string): BigNumber[] {
    const fragment = this.contractInterface.getFunction(this.functionName);
    return this.contractInterface.decodeFunctionResult(
      fragment,
      callResults
    )[0] as unknown as BigNumber[];
  }
  public handleRevert(callResults: string): BigNumber[] {
    const msg = this.contractInterface
      .decodeErrorResult(this.functionName, callResults)
      .toString();
    logger.warn(
      `Sampler Operation: ${this.protocol}.${this.functionName} reverted ${msg}`
    );
    return [];
  }
}

export class SamplerOperation {
  constructor(
    public readonly chainId: ChainId,
    protected readonly contractInterface: Interface
  ) {}
  public getUniswapV2SellQuotes(
    tokenAddressPath: string[],
    takerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.UniswapV2
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromUniswapV2',
      functionParams: [tokenAddressPath, takerFillAmounts],
    });
  }

  public getUniswapV2BuyQuotes(
    tokenAddressPath: string[],
    makerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.UniswapV2
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromUniswapV2',
      functionParams: [tokenAddressPath, makerFillAmounts],
    });
  }

  public getEth2DaiSellQuotes(
    tokenAddressPath: string[],
    takerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.Eth2Dai
  ): SourceContractOperation {
    invariant(tokenAddressPath.length == 2, 'sell quote in Eth2Dai');
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromEth2Dai',
      functionParams: [...tokenAddressPath, takerFillAmounts],
    });
  }

  public getEth2DaiBuyQuotes(
    tokenAddressPath: string[],
    makerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.Eth2Dai
  ): SourceContractOperation {
    invariant(tokenAddressPath.length == 2, 'buy quote in Eth2Dai');
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromEth2Dai',
      functionParams: [...tokenAddressPath, makerFillAmounts],
    });
  }

  public getCurveBuyQuotes(
    poolAddress: string,
    fromTokenIdx: number,
    toTokenIdx: number,
    makerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.Curve,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromCurve',
      functionParams: [poolAddress, fromTokenIdx, toTokenIdx, makerFillAmounts],
    });
  }

  public getCurveSellQuotes(
    poolAddress: string,
    fromTokenIdx: number,
    toTokenIdx: number,
    takerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.Curve,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromCurve',
      functionParams: [poolAddress, fromTokenIdx, toTokenIdx, takerFillAmounts],
    });
  }

  // some getter operations that nothing to do with trading
  public getOrderFillableMakerAssetAmounts(
    orders: SignedOrder[]
  ): ContractOperation<BigNumber[]> {
    return new SamplerContractOperation({
      protocol: Protocol.ZeroX,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'getOrderFillableMakerAssetAmounts',
      functionParams: [orders, orders.map(o => o.signature)],
    });
  }

  public getOrderFillableTakerAssetAmounts(
    orders: SignedOrder[]
  ): ContractOperation<BigNumber[]> {
    return new SamplerContractOperation({
      protocol: Protocol.ZeroX,
      contractInterface: Erc20BridgeSampler__factory.createInterface(),
      functionName: 'getOrderFillableTakerAssetAmounts',
      functionParams: [orders, orders.map(o => o.signature)],
    });
  }

  private getSellQuoteOperations(
    amounts: BigNumber[],
    routes: SamplerRoute[]
  ): SourceContractOperation[] {
    const allOps = _.map(routes, route => {
      const protocol = route.protocol;
      switch (protocol) {
        case Protocol.UniswapV2:
          return this.getUniswapV2SellQuotes(route.path, amounts, protocol);
        case Protocol.Eth2Dai:
          return this.getEth2DaiSellQuotes(route.path, amounts, protocol);
        case Protocol.Curve: {
          invariant(route.poolAddress, 'Curve Pool Address');
          const poolAddress = route.poolAddress;
          const curveInfo = getCurveInfosForPool(poolAddress);
          const fromTokenIdx = curveInfo.tokens.indexOf(route.path[0]);
          const toTokenIdx = curveInfo.tokens.indexOf(route.path[1]);
          return this.getCurveSellQuotes(
            poolAddress,
            fromTokenIdx,
            toTokenIdx,
            amounts
          );
        }
        default:
          throw new Error(`Unsupported sell sample protocol: ${protocol}`);
      }
    });

    return allOps;
  }

  private getBuyQuoteOperations(
    amounts: BigNumber[],
    routes: SamplerRoute[]
  ): SourceContractOperation[] {
    const allOps = _.map(routes, route => {
      const protocol = route.protocol;
      switch (protocol) {
        case Protocol.UniswapV2:
        case Protocol.SushiSwap:
          return this.getUniswapV2BuyQuotes(route.path, amounts, protocol);
        case Protocol.Eth2Dai:
          return this.getEth2DaiBuyQuotes(route.path, amounts, protocol);
        case Protocol.Curve: {
          invariant(route.poolAddress, 'Curve Pool Address');
          const poolAddress = route.poolAddress;
          const curveInfo = getCurveInfosForPool(poolAddress);
          const fromTokenIdx = curveInfo.tokens.indexOf(route.path[0]);
          const toTokenIdx = curveInfo.tokens.indexOf(route.path[1]);
          return this.getCurveBuyQuotes(
            poolAddress,
            fromTokenIdx,
            toTokenIdx,
            amounts
          );
        }
        default:
          throw new Error(`Unsupported buy sample protocol: ${protocol}`);
      }
    });

    return allOps;
  }

  public getSellQuotes(
    amounts: BigNumber[],
    routes: SamplerRoute[]
  ): ContractOperation<DexSample[][]> {
    const subOps = this.getSellQuoteOperations(amounts, routes);
    return this.createBatch(
      subOps,
      (samples: BigNumber[][]) => {
        return _.map(routes, (route, i) => {
          return _.map(samples[i], (output, j) => {
            return { protocol: route.protocol, input: amounts[j], output };
          });
        });
      },
      () => []
    );
  }

  public getBuyQuotes(
    amounts: BigNumber[],
    routes: SamplerRoute[]
  ): ContractOperation<DexSample[][]> {
    const subOps = this.getBuyQuoteOperations(amounts, routes);
    return this.createBatch(
      subOps,
      (samples: BigNumber[][]) => {
        return _.map(routes, (route, i) => {
          return _.map(samples[i], (output, j) => {
            return { protocol: route.protocol, input: amounts[j], output };
          });
        });
      },
      () => []
    );
  }

  // wraps subOps into single batch operation
  private createBatch<T, TResult>(
    subOps: ContractOperation<TResult>[],
    resultHandler: (results: TResult[]) => T,
    revertHandler: (result: string) => T
  ): ContractOperation<T> {
    return {
      encodeCall: () => {
        const subCalls = _.map(subOps, subOp => subOp.encodeCall());
        return this.contractInterface.encodeFunctionData('batchCall', [
          subCalls,
        ]);
      },
      handleCallResults: callResults => {
        const { callResults: rawSubcallResults } =
          this.contractInterface.decodeFunctionResult('batchCall', callResults);
        const results = _.map(subOps, (op, i) => {
          return op.handleCallResults(rawSubcallResults[i]);
        });
        return resultHandler(results);
      },
      handleRevert: revertHandler,
    };
  }
}

export type SamplerOverrides = {
  blockNumber?: number;
};

const NULL_BYTES = '0x0';

export class Sampler extends SamplerOperation {
  private samplerContract: Erc20BridgeSampler;
  constructor(
    chainId: ChainId,
    protected provider: providers.BaseProvider,
    protected samplerOverrides: SamplerOverrides
  ) {
    super(chainId, Erc20BridgeSampler__factory.createInterface());
    const samplerAddress = contractAddressesByChain[chainId]!.quoter;
    if (!samplerAddress) {
      throw new Error(
        `No address for sampler contract on chain id: ${chainId}`
      );
    }
    this.samplerContract = Erc20BridgeSampler__factory.connect(
      samplerAddress,
      this.provider
    );
  }
  public async executeAsync(...ops: any[]): Promise<any[]> {
    return this.executeBatchAsync(ops);
  }

  public async executeBatchAsync<FunctionParams extends any[] | undefined>(
    ops: SamplerContractOperation<FunctionParams>[]
  ): Promise<any[]> {
    const callDatas = _.map(ops, o => o.encodeCall());
    const { blockNumber } = this.samplerOverrides;
    if (callDatas.every(cd => cd === NULL_BYTES)) {
      return _.map(callDatas, (_callData, i) => {
        return ops[i].handleCallResults(NULL_BYTES);
      });
    }

    const rawCallResults = await this.samplerContract.callStatic.batchCall(
      _.filter(callDatas, cd => cd !== NULL_BYTES),
      { blockTag: blockNumber }
    );
    // return parsed results
    let rawCallResultsIdx = 0;
    return _.map(callDatas, (callData, i) => {
      const result =
        callData !== NULL_BYTES
          ? rawCallResults[rawCallResultsIdx++]
          : NULL_BYTES;
      return ops[i].handleCallResults(result);
    });
  }
}
