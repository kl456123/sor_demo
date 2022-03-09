// wrapper for erc20 bridge sampler contract

import { SignedOrder } from '@0x/types';
import { Interface } from '@ethersproject/abi';
import { BigNumber, BigNumberish, providers } from 'ethers';
import _ from 'lodash';
import invariant from 'tiny-invariant';

import {
  ERC20BridgeSampler,
  ERC20BridgeSampler__factory,
} from '../typechain-types';

import {
  BALANCER_V2_VAULT_ADDRESS_BY_CHAIN,
  contractAddressesByChain,
  DODOV1_CONFIG_BY_CHAIN_ID,
  DODOV2_FACTORIES_BY_CHAIN_ID,
  uniswapV2RouterByChain,
  UNISWAPV3_CONFIG_BY_CHAIN_ID,
  KYBER_CONFIG_BY_CHAIN_ID,
  BANCOR_REGISTRY_BY_CHAIN_ID,
  MAKER_PSM_INFO_BY_CHAIN_ID,
} from './addresses';
import { DirectSwapRoute } from './entitiesv2';
import { logger } from './logging';
import { getCurveInfosForPool } from './markets/curve';
import { BalancerV2PoolInfo } from './markets/types';
import { UniswapV3PoolData } from './markets/uniswapv3_subgraph_provider';
import { SampleParams } from './sampler_params';
import { ChainId, Protocol } from './types';

export interface ContractOperation<TResult> {
  encodeCall(): string;
  handleCallResults(callResults: string): TResult;
  handleRevert(callResults: string): TResult;
}

export interface SourceContractOperation
  extends ContractOperation<BigNumber[]> {
  readonly protocol: Protocol;
}

// export interface SamplerRoute {
// protocol: Protocol;
// poolAddress?: string;
// path: string[];
// }
export type SamplerRoute = SampleParams;

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
      .decodeFunctionResult(this.functionName, callResults)
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
    router: string,
    tokenAddressPath: string[],
    takerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.UniswapV2
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromUniswapV2',
      functionParams: [router, tokenAddressPath, takerFillAmounts],
    });
  }

  public getUniswapV2BuyQuotes(
    router: string,
    tokenAddressPath: string[],
    makerFillAmounts: BigNumber[],
    protocol: Protocol = Protocol.UniswapV2
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: protocol,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromUniswapV2',
      functionParams: [router, tokenAddressPath, makerFillAmounts],
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
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
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
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromEth2Dai',
      functionParams: [...tokenAddressPath, makerFillAmounts],
    });
  }

  public getCurveBuyQuotes(
    poolAddress: string,
    sellQuoteFunctionSelector: string,
    buyQuoteFunctionSelector: string,
    fromTokenIdx: number,
    toTokenIdx: number,
    makerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.Curve,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromCurve',
      functionParams: [
        {
          poolAddress,
          sellQuoteFunctionSelector,
          buyQuoteFunctionSelector,
        },
        fromTokenIdx,
        toTokenIdx,
        makerFillAmounts,
      ],
    });
  }

  public getCurveSellQuotes(
    poolAddress: string,
    sellQuoteFunctionSelector: string,
    buyQuoteFunctionSelector: string,
    fromTokenIdx: number,
    toTokenIdx: number,
    takerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.Curve,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromCurve',
      functionParams: [
        {
          poolAddress,
          sellQuoteFunctionSelector,
          buyQuoteFunctionSelector,
        },
        fromTokenIdx,
        toTokenIdx,
        takerFillAmounts,
      ],
    });
  }

  public getBalancerV2BuyQuotes(
    poolInfo: BalancerV2PoolInfo,
    makerToken: string,
    takerToken: string,
    makerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.BalancerV2,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromBalancerV2',
      functionParams: [poolInfo, makerToken, takerToken, makerFillAmounts],
    });
  }

  public getBalancerV2SellQuotes(
    poolInfo: BalancerV2PoolInfo,
    makerToken: string,
    takerToken: string,
    takerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.BalancerV2,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromBalancerV2',
      functionParams: [poolInfo, makerToken, takerToken, takerFillAmounts],
    });
  }

  public getDODOSellQuotes(
    registry: string,
    helper: string,
    makerToken: string,
    takerToken: string,
    takerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.DODO,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromDODO',
      functionParams: [
        { registry, helper },
        takerToken,
        makerToken,
        takerFillAmounts,
      ],
    });
  }

  public getDODOBuyQuotes(
    registry: string,
    helper: string,
    makerToken: string,
    takerToken: string,
    makerFillAmounts: BigNumber[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.DODO,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromDODO',
      functionParams: [
        { registry, helper },
        takerToken,
        makerToken,
        makerFillAmounts,
      ],
    });
  }

  public getUniswapV3SellQuotes(
    quoter: string,
    tokenAddressPath: string[],
    takerFillAmounts: BigNumber[],
    fees: BigNumberish[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.UniswapV3,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleSellsFromUniswapV3',
      functionParams: [quoter, tokenAddressPath, takerFillAmounts, fees],
    });
  }

  public getUniswapV3BuyQuotes(
    quoter: string,
    tokenAddressPath: string[],
    makerFillAmounts: BigNumber[],
    fees: BigNumberish[]
  ): SourceContractOperation {
    return new SamplerContractOperation({
      protocol: Protocol.UniswapV3,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'sampleBuysFromUniswapV3',
      functionParams: [quoter, tokenAddressPath, makerFillAmounts, fees],
    });
  }

  // some getter operations that nothing to do with trading
  public getOrderFillableMakerAssetAmounts(
    orders: SignedOrder[]
  ): ContractOperation<BigNumber[]> {
    return new SamplerContractOperation({
      protocol: Protocol.ZeroX,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'getOrderFillableMakerAssetAmounts',
      functionParams: [orders, orders.map(o => o.signature)],
    });
  }

  public getOrderFillableTakerAssetAmounts(
    orders: SignedOrder[]
  ): ContractOperation<BigNumber[]> {
    return new SamplerContractOperation({
      protocol: Protocol.ZeroX,
      contractInterface: ERC20BridgeSampler__factory.createInterface(),
      functionName: 'getOrderFillableTakerAssetAmounts',
      functionParams: [orders, orders.map(o => o.signature)],
    });
  }

  public getBalancerSellQuotes(
          poolAddress: string,
          makerToken: string,
          takerToken: string,
          takerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Balancer,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleSellsFromBalancer',
              functionParams: [poolAddress, takerToken, makerToken, takerFillAmounts],
          });
      }

      public getBalancerBuyQuotes(
          poolAddress: string,
          makerToken: string,
          takerToken: string,
          makerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Balancer,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleBuysFromBalancer',
              functionParams: [poolAddress, takerToken, makerToken, makerFillAmounts],
          });
      }

public getBancorSellQuotes(
          registry: string,
          makerToken: string,
          takerToken: string,
          paths: string[][],
          takerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Bancor,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleSellsFromBancor',
              functionParams: [{ registry, paths }, takerToken, makerToken, takerFillAmounts],
          });
      }

      // Unimplemented
      public getBancorBuyQuotes(
          registry: string,
          makerToken: string,
          takerToken: string,
          paths: string[][],
          makerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Bancor,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleBuysFromBancor',
              functionParams: [{ registry, paths }, takerToken, makerToken, makerFillAmounts],
          });
      }


  public getMakerPsmSellQuotes(
          psmAddress: string,
          ilkIdentifier: string,
          gemTokenAddress: string,
          makerToken: string,
          takerToken: string,
          takerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.MakerPSM,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleSellsFromMakerPsm',
              functionParams: [{psmAddress, ilkIdentifier, gemTokenAddress}, takerToken, makerToken, takerFillAmounts],
          });
      }

      public getMakerPsmBuyQuotes(
          psmAddress: string,
          ilkIdentifier: string,
          gemTokenAddress: string,
          makerToken: string,
          takerToken: string,
          makerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.MakerPSM,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleBuysFromMakerPsm',
              functionParams: [{psmAddress, ilkIdentifier, gemTokenAddress}, takerToken, makerToken, makerFillAmounts],
          });
      }

      public getKyberSellQuotes(
          networkProxy: string,
          hintHandler: string,
          weth: string,
          reserveOffset: number,
          makerToken: string,
          takerToken: string,
          takerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Kyber,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleSellsFromKyberNetwork',
              functionParams: [{networkProxy, hintHandler, weth ,reserveOffset, hint: NULL_BYTES }, takerToken, makerToken, takerFillAmounts],
          });
      }

      public getKyberBuyQuotes(
          networkProxy: string,
          hintHandler: string,
          weth: string,
          reserveOffset: BigNumber,
          makerToken: string,
          takerToken: string,
          makerFillAmounts: BigNumber[],
      ): SourceContractOperation {
          return new SamplerContractOperation({
              protocol: Protocol.Kyber,
              contractInterface: ERC20BridgeSampler__factory.createInterface(),
              functionName: 'sampleBuysFromKyberNetwork',
              functionParams: [{networkProxy, hintHandler, weth ,reserveOffset, hint: NULL_BYTES }, takerToken, makerToken, makerFillAmounts],
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
          return this.getUniswapV2SellQuotes(
            route.router,
            route.path,
            amounts,
            protocol
          );
        case Protocol.Curve: {
          return this.getCurveSellQuotes(
            route.poolAddress,
            route.sellQuoteFunctionSelector,
            route.buyQuoteFunctionSelector,
            route.fromTokenIdx,
            route.toTokenIdx,
            amounts
          );
        }
        case Protocol.BalancerV2: {
          return this.getBalancerV2SellQuotes(
            { poolId: route.poolId, vault: route.vault },
            route.makerToken,
            route.takerToken,
            amounts
          );
        }
        case Protocol.UniswapV3: {
          return this.getUniswapV3SellQuotes(
            route.quoter,
            route.path,
            amounts,
            route.fees
          );
        }
        case Protocol.DODO: {
          return this.getDODOSellQuotes(
            route.registry,
            route.helper,
            route.makerToken,
            route.takerToken,
            amounts
          );
        }
          case Protocol.Kyber:{
              return this.getKyberSellQuotes(
                  route.networkProxy, route.hintHandler, route.weth, route.reserveOffset, route.makerToken, route.takerToken, amounts);
          }
          case Protocol.Bancor:{
              return this.getBancorSellQuotes(route.registry, route.makerToken, route.takerToken, route.paths, amounts);
          }
          case Protocol.MakerPSM:{
              return this.getMakerPsmSellQuotes(route.psmAddress, route.ilkIdentifier, route.gemTokenAddress, route.makerToken, route.takerToken, amounts);
          }
        default:
          throw new Error(`Unsupported sell sample protocol: ${protocol}`);
      }
    });

    return allOps;
  }

  public fillParams(route: DirectSwapRoute): SamplerRoute {
    switch (route.pool.protocol) {
      case Protocol.UniswapV2: {
        return {
          protocol: route.pool.protocol,
          path: [route.input.address, route.output.address],
          router: uniswapV2RouterByChain[this.chainId]!,
        };
      }
      case Protocol.UniswapV3: {
        const { quoter } = UNISWAPV3_CONFIG_BY_CHAIN_ID[this.chainId]!;
        const poolData = route.pool.poolData as UniswapV3PoolData;
        return {
          protocol: route.pool.protocol,
          quoter: quoter,
          path: [route.input.address, route.output.address],
          fees: [poolData.feeTier],
        };
      }
      case Protocol.Curve: {
        const poolAddress = route.pool.id;
        const curveInfo = getCurveInfosForPool(poolAddress);
        const tokensAddress = curveInfo.tokens.map(token => token.address);
        const fromTokenIdx = tokensAddress.indexOf(route.input.address);
        const toTokenIdx = tokensAddress.indexOf(route.output.address);
        return {
          protocol: Protocol.Curve,
          poolAddress: route.pool.id,
          sellQuoteFunctionSelector: curveInfo.sellQuoteFunctionSelector,
          buyQuoteFunctionSelector: curveInfo.buyQuoteFunctionSelector,
          fromTokenIdx,
          toTokenIdx,
        };
      }
      case Protocol.BalancerV2: {
        const vault = BALANCER_V2_VAULT_ADDRESS_BY_CHAIN[this.chainId]!;
        return {
          protocol: Protocol.BalancerV2,
          poolId: route.pool.id,
          vault,
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
      case Protocol.Balancer:{
          return {
            poolAddress: route.pool.id,
            makerToken: route.output.address,
            takerToken: route.input.address,
            protocol: Protocol.Balancer,
            };
        }
      case Protocol.DODO: {
        const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET]!;
        return {
          protocol: Protocol.DODO,
          registry: opts.registry,
          helper: opts.helper,
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
      case Protocol.DODOV2: {
        const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET]![0];
        const offset = 0;
        return {
          protocol: Protocol.DODOV2,
          registry,
          offset,
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
        case Protocol.Kyber:{
            const opts = KYBER_CONFIG_BY_CHAIN_ID[this.chainId]!;
            return {
                protocol:Protocol.Kyber,
                reserveOffset: 0,
                hintHandler: opts.hintHandler,
                networkProxy: opts.networkProxy,
                weth: opts.weth,
                hint: '0x',
                takerToken: route.input.address,
                makerToken: route.output.address,
            };
        }
        case Protocol.Bancor:{
        const paths: string[][] = [[]];
            return {
                protocol: Protocol.Bancor,
                registry: BANCOR_REGISTRY_BY_CHAIN_ID[this.chainId]!,
                takerToken: route.input.address,
                makerToken: route.output.address,
                paths,
            };
        }
        case Protocol.MakerPSM:{
        const {psmAddress, gemTokenAddress, ilkIdentifier} = MAKER_PSM_INFO_BY_CHAIN_ID[this.chainId]!;
            return {
                protocol: Protocol.MakerPSM,
                psmAddress,
                ilkIdentifier,
                gemTokenAddress,
                takerToken: route.input.address,
                makerToken: route.output.address,
            };
        }
        case Protocol.ZeroX:{
            return {
                protocol: Protocol.ZeroX
            };
        }
      default:
        throw new Error(
          `Unsupported fill params protocol: ${route.pool.protocol}`
        );
    }
  }

  private getBuyQuoteOperations(
    amounts: BigNumber[],
    routes: SamplerRoute[]
  ): SourceContractOperation[] {
    const allOps = _.map(routes, route => {
      const protocol = route.protocol;
      switch (protocol) {
        case Protocol.UniswapV2:
          return this.getUniswapV2BuyQuotes(
            uniswapV2RouterByChain[this.chainId]!,
            route.path,
            amounts,
            protocol
          );
        case Protocol.Curve: {
          return this.getCurveBuyQuotes(
            route.poolAddress,
            route.sellQuoteFunctionSelector,
            route.buyQuoteFunctionSelector,
            route.fromTokenIdx,
            route.toTokenIdx,
            amounts
          );
        }
        case Protocol.BalancerV2: {
          return this.getBalancerV2BuyQuotes(
            { poolId: route.poolId, vault: route.vault },
            route.makerToken,
            route.takerToken,
            amounts
          );
        }
        case Protocol.UniswapV3: {
          return this.getUniswapV3BuyQuotes(
            route.quoter,
            route.path.reverse(),
            amounts,
            route.fees
          );
        }
        case Protocol.DODO: {
          return this.getDODOBuyQuotes(
            route.registry,
            route.helper,
            route.makerToken,
            route.takerToken,
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
        const rawSubCallResults = this.contractInterface.decodeFunctionResult(
          'batchCall',
          callResults
        )[0];
        const results = subOps.map((op, i) =>
          rawSubCallResults[i].success
            ? op.handleCallResults(rawSubCallResults[i].data)
            : op.handleRevert(rawSubCallResults[i].data)
        );
        return resultHandler(results);
      },
      handleRevert: revertHandler,
    };
  }
}

export type SamplerOverrides = {
  blockNumber?: number;
};

const NULL_BYTES = '0x';

export class Sampler extends SamplerOperation {
  private samplerContract: ERC20BridgeSampler;
  constructor(
    chainId: ChainId,
    protected provider: providers.BaseProvider,
    protected samplerOverrides: SamplerOverrides
  ) {
    super(chainId, ERC20BridgeSampler__factory.createInterface());
    let samplerAddress = contractAddressesByChain[chainId]!.quoter;
    samplerAddress = '0x5302e909d1e93e30f05b5d6eea766363d14f9892';
    if (!samplerAddress) {
      throw new Error(
        `No address for sampler contract on chain id: ${chainId}`
      );
    }
    this.samplerContract = ERC20BridgeSampler__factory.connect(
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
    return callDatas.map((callData, i) => {
      // tslint:disable-next-line:boolean-naming
      const { data, success } =
        callData !== NULL_BYTES
          ? rawCallResults[rawCallResultsIdx++]
          : { success: true, data: NULL_BYTES };
      return success
        ? ops[i].handleCallResults(data)
        : ops[i].handleRevert(data);
    });
  }
}
