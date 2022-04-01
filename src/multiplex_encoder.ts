import { BigNumber, BigNumberish, BytesLike, ethers, utils } from 'ethers';

import { Quoter__factory } from '../typechain-types/factories/Quoter__factory';

import {
  DODOV1_CONFIG_BY_CHAIN_ID,
  DODOV2_FACTORIES_BY_CHAIN_ID,
} from './addresses';
import { Protocol2Id } from './constants';
import {
  getCurveInfosForPool,
  getCurveLikeInfosForPool,
} from './markets/curve';
import { ChainId, Protocol, ProtocolId, TradeType } from './types';

export enum MultiplexSubcallType {
  Invalid,
  TransformERC20,
  BatchSell,
  MultiHopSell,
  Quoter,
}

export enum TransformerType {
  Invalid,
  FillQuoteTransformer,
}

export type TransformerParams = {
  transformerType: TransformerType;
  transformData: TransformData;
  transformer: string;
};

export enum OrderType {
  Bridge,
  Limit,
  Rfq,
}

export type BridgeOrder = {
  source: BytesLike;
  takerTokenAmount: BigNumberish;
  makerTokenAmount: BigNumberish;
  bridgeData: BridgeData;
};

export type LimitOrder = {
  makerToken: string;
  takerToken: string;
  makerAmount: BigNumber;
  takerAmount: BigNumber;
  takerTokenFeeAmount: BigNumber;
  taker: string;
  maker: string;
  expiry: BigNumberish;
  salt: BigNumber;
};

export type RfqOrder = {
  makerToken: string;
  takerToken: string;
  makerAmount: BigNumber;
  takerAmount: BigNumber;
  taker: string;
  maker: string;
  expiry: BigNumberish;
  salt: BigNumber;
};

export type BridgeData = QuoteParams;

export type UniswapV3Data = {
  protocol: Protocol.UniswapV3;
};

export type TransformData = FillQuoteTransformData;

export type FillQuoteTransformData = {
  side: TradeType;
  sellToken: string;
  buyToken: string;
  orderType: OrderType;
  bridgeOrder?: BridgeOrder;
  limitOrder?: LimitOrder;
  rfqOrder?: RfqOrder;
  fillAmount: BigNumberish;
};

export type QuoteParams =
  | QuoteFromBalancerParams
  | QuoteFromBalancerV2Params
  | QuoteFromUniswapV3Params
  | QuoteFromUniswapV2Params
  | QuoteFromCurveParmas
  | QuoteFromDODOParams
  | QuoteFromKyberParams
  | QuoteFromNativeOrderParams
  | QuoteFromMakerPSMParams
  | QuoteFromBancorParams
  | QuoteFromKyberDMMParams
  | QuoteFromDODOV2Params;

export type QuoteFromKyberDMMParams = {
  protocol: Protocol.KyberDMM;
  router: string;
  pools: string[];
  path: string[];
};

export type QuoteFromMakerPSMParams = {
  protocol: Protocol.MakerPSM;
  psmAddress: string;
  ilkIdentifier: string;
  gemTokenAddress: string;
  takerToken: string;
  makerToken: string;
};

export type QuoteFromBancorParams = {
  protocol: Protocol.Bancor;
  registry: string;
  takerToken: string;
  makerToken: string;
  paths: string[][];
};

export type QuoteFromNativeOrderParams = {
  protocol: Protocol.ZeroX;
};

export type QuoteFromKyberParams = {
  protocol: Protocol.Kyber;
  reserveOffset: number;
  hintHandler: string;
  networkProxy: string;
  weth: string;
  hint: string;
  takerToken: string;
  makerToken: string;
};

export type QuoteFromBalancerParams = {
  protocol: Protocol.Balancer;
  poolAddress: string;
  takerToken: string;
  makerToken: string;
};

export type QuoteFromBalancerV2Params = {
  protocol: Protocol.BalancerV2;
  poolId: BytesLike;
  vault: string;
  takerToken: string;
  makerToken: string;
};

export type QuoteFromUniswapV2Params = {
  protocol: Protocol.UniswapV2;
  router: string;
  path: string[];
};

export type QuoteFromCurveParmas = {
  protocol: Protocol.Curve | Protocol.CurveV2;
  poolAddress: string;
  fromToken: string;
  toToken: string;
};

export type QuoteFromUniswapV3Params = {
  protocol: Protocol.UniswapV3;
  quoter: string;
  path: string[];
  fees: BigNumberish[];
};

export type QuoteFromDODOParams = {
  protocol: Protocol.DODO;
  registry: string;
  helper: string;
  takerToken: string;
  makerToken: string;
  pool: string;
  isSellBase: boolean;
};

export type QuoteFromDODOV2Params = {
  protocol: Protocol.DODOV2;
  registry: string;
  offset: BigNumberish;
  takerToken: string;
  makerToken: string;
  pool: string;
  isSellBase: boolean;
};

export type BatchSellSubcall = {
  id: MultiplexSubcallType;
  sellAmount: BigNumber;
  data: QuoteParams | MultiHopSellParams | TransformerParams[];
};

export type EncodedBatchSellSubcall = {
  id: MultiplexSubcallType;
  sellAmount: BigNumberish;
  data: BytesLike;
};

export type MultiHopSellSubcall = {
  id: MultiplexSubcallType;
  data: BatchSellParams;
};

export type EncodedMultiHopSellSubcall = {
  id: MultiplexSubcallType;
  data: BytesLike;
};

export type BatchSellParams = {
  calls: BatchSellSubcall[];
};

export type MultiHopSellParams = {
  tokens: string[];
  calls: MultiHopSellSubcall[];
};

export function encodeMultiplexMultiHop(
  calls: MultiHopSellSubcall[]
): EncodedMultiHopSellSubcall[] {
  const encodedCalls: EncodedMultiHopSellSubcall[] = [];
  for (let i = 0; i < calls.length; ++i) {
    const encodedCall: EncodedMultiHopSellSubcall = {
      id: calls[i].id,
      data: '0x00',
    };
    const encodedBatchCalls = encodeMultiplexBatch(calls[i].data.calls);
    encodedCall.data = utils.defaultAbiCoder.encode(
      ['tuple(uint8 id,uint256 sellAmount,bytes data)[]'],
      [encodedBatchCalls]
    );
    encodedCalls.push(encodedCall);
  }
  return encodedCalls;
}

export function encodeMultiplexBatch(
  calls: BatchSellSubcall[]
): EncodedBatchSellSubcall[] {
  const encodedCalls: EncodedBatchSellSubcall[] = [];
  for (const call of calls) {
    const encodedCall: EncodedBatchSellSubcall = {
      id: MultiplexSubcallType.Invalid,
      sellAmount: 0,
      data: '0x00',
    };
    encodedCall.id = call.id;
    encodedCall.sellAmount = call.sellAmount;
    switch (call.id) {
      case MultiplexSubcallType.Quoter:
        encodedCall.data = encodeQuoter(call.data as QuoteParams);
        break;
      case MultiplexSubcallType.MultiHopSell: {
        const encodedmultihopcalls = encodeMultiplexMultiHop(
          (call.data as MultiHopSellParams).calls
        );
        const tokens = (call.data as MultiHopSellParams).tokens;
        encodedCall.data = utils.defaultAbiCoder.encode(
          ['address[]', 'tuple(uint8 id,bytes data)[]'],
          [tokens, encodedmultihopcalls]
        );
        break;
      }
      case MultiplexSubcallType.TransformERC20: {
        encodedCall.data = encodeTransformer(call.data as TransformerParams[]);
        break;
      }
      default:
        throw new Error(`Unsupported MultiplexSubcallType: ${call.id}`);
    }
    encodedCalls.push(encodedCall);
  }
  return encodedCalls;
}

export function encodeQuoter(params: QuoteParams): BytesLike {
  const contractInterface = Quoter__factory.createInterface();
  switch (params.protocol) {
    case Protocol.BalancerV2: {
      const paramsData = utils.defaultAbiCoder.encode(
        [
          'tuple(bytes32 poolId,address vault,address takerToken,address makerToken)',
        ],
        [params]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromBalancerV2'), paramsData]
      );
    }
    case Protocol.UniswapV2: {
      const paramsData = utils.defaultAbiCoder.encode(
        ['tuple(address router,address[] path)'],
        [{ router: params.router, path: params.path }]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromUniswapV2'), paramsData]
      );
    }
    case Protocol.UniswapV3: {
      const paramsData = utils.defaultAbiCoder.encode(
        ['tuple(address quoter,address[] path,uint24[] fees)'],
        [{ quoter: params.quoter, path: params.path, fees: params.fees }]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromUniswapV3'), paramsData]
      );
    }
    case Protocol.Curve: {
      // select the first one
      const curveInfo = getCurveInfosForPool(params.poolAddress);
      const tokens = curveInfo.tokens.map(token => token.address);
      const fromTokenIdx = tokens.indexOf(params.fromToken);
      const toTokenIdx = tokens.indexOf(params.toToken);
      const paramsData = utils.defaultAbiCoder.encode(
        [
          'tuple(address poolAddress,bytes4 sellQuoteFunctionSelector,bytes4 buyQuoteFunctionSelector,uint256 fromTokenIdx,uint256 toTokenIdx)',
        ],
        [
          {
            poolAddress: curveInfo.poolAddress,
            sellQuoteFunctionSelector: curveInfo.sellQuoteFunctionSelector,
            buyQuoteFunctionSelector: curveInfo.buyQuoteFunctionSelector,
            fromTokenIdx,
            toTokenIdx,
          },
        ]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromCurve'), paramsData]
      );
    }
    case Protocol.DODO: {
      const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET];
      const paramsData = utils.defaultAbiCoder.encode(
        [
          'tuple(address registry,address helper,address takerToken,address makerToken)',
        ],
        [
          {
            registry: opts.registry,
            helper: opts.helper,
            takerToken: params.takerToken,
            makerToken: params.makerToken,
          },
        ]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromDODO'), paramsData]
      );
    }
    case Protocol.DODOV2: {
      const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET][0];
      const offset = 0;
      const paramsData = utils.defaultAbiCoder.encode(
        [
          'tuple(address registry,uint256 offset,address takerToken,address makerToken)',
        ],
        [
          {
            registry: registry,
            offset,
            takerToken: params.takerToken,
            makerToken: params.makerToken,
          },
        ]
      );
      return utils.defaultAbiCoder.encode(
        ['bytes4', 'bytes'],
        [contractInterface.getSighash('quoteSellFromDODOV2'), paramsData]
      );
    }
    default: {
      throw new Error(`unknown protocol: ${params.protocol}`);
    }
  }
}

export type Transformation = {
  transformer: string;
  data: BytesLike;
};

export function encodeBridgeOrder(params: BridgeData): BytesLike {
  switch (params.protocol) {
    case Protocol.Balancer: {
      return utils.defaultAbiCoder.encode(['address'], [params.poolAddress]);
    }
    case Protocol.Bancor: {
      return utils.defaultAbiCoder.encode(
        ['address bancorNetworkAddress', 'address[] path'],
        [params.registry, params.paths]
      );
    }
    case Protocol.BalancerV2: {
      return utils.defaultAbiCoder.encode(
        ['tuple(address vault,bytes32 poolId)'],
        [{ vault: params.vault, poolId: params.poolId }]
      );
    }
    case Protocol.UniswapV2: {
      return utils.defaultAbiCoder.encode(
        ['tuple(address router,address[] path)'],
        [{ router: params.router, path: params.path }]
      );
    }
    case Protocol.UniswapV3: {
      return utils.defaultAbiCoder.encode(
        ['tuple(address quoter,address[] path,uint24[] fees)'],
        [{ quoter: params.quoter, path: params.path, fees: params.fees }]
      );
    }
    case Protocol.CurveV2:
    case Protocol.Curve: {
      // select the first one
      const curveInfo = getCurveLikeInfosForPool({
        poolAddress: params.poolAddress,
        protocol: params.protocol,
      });
      const tokens = curveInfo.tokens.map(token => token.address);
      const fromTokenIdx = tokens.indexOf(params.fromToken);
      const toTokenIdx = tokens.indexOf(params.toToken);
      return utils.defaultAbiCoder.encode(
        [
          'tuple(address poolAddress,bytes4 exchangeFunctionSelector,uint256 fromTokenIdx,uint256 toTokenIdx)',
        ],
        [
          {
            poolAddress: curveInfo.poolAddress,
            exchangeFunctionSelector: curveInfo.exchangeFunctionSelector,
            fromTokenIdx,
            toTokenIdx,
          },
        ]
      );
    }
    case Protocol.DODO: {
      const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET];
      return utils.defaultAbiCoder.encode(
        ['address', 'address', 'bool'],
        [opts.helper, params.pool, params.isSellBase]
      );
    }
    case Protocol.DODOV2: {
      return utils.defaultAbiCoder.encode(
        ['address pool', 'bool isSellBase'],
        [params.pool, params.isSellBase]
      );
    }
    case Protocol.Kyber: {
      return utils.defaultAbiCoder.encode(
        ['address', 'bytes'],
        [params.networkProxy, params.hint]
      );
    }
    case Protocol.KyberDMM: {
      return utils.defaultAbiCoder.encode(
        ['address', 'address[]', 'address[]'],
        [params.router, params.pools, params.path]
      );
    }
    case Protocol.MakerPSM: {
      return utils.defaultAbiCoder.encode(
        ['address', 'address'],
        [params.psmAddress, params.gemTokenAddress]
      );
    }
    default: {
      throw new Error(`unknown protocol: ${params.protocol}`);
    }
  }
}

export function encodeTransformer(
  transformersParams: TransformerParams[]
): BytesLike {
  const transformations: Transformation[] = [];
  // multiple transform stages
  for (const transformerParams of transformersParams) {
    switch (transformerParams.transformerType) {
      case TransformerType.FillQuoteTransformer: {
        const fqtData = transformerParams.transformData;
        let data = '';
        if (fqtData.orderType == OrderType.Bridge && fqtData.bridgeOrder) {
          const bridgeOrderData = encodeBridgeOrder(
            fqtData.bridgeOrder.bridgeData
          );

          const bridgeOrder = {
            source: fqtData.bridgeOrder.source,
            makerTokenAmount: fqtData.bridgeOrder.makerTokenAmount,
            takerTokenAmount: fqtData.bridgeOrder.takerTokenAmount,
            bridgeData: bridgeOrderData,
          };
          data = utils.defaultAbiCoder.encode(
            [
              'tuple(uint8 side, address sellToken, address buyToken, tuple(bytes32 source, uint256 takerTokenAmount, uint256 makerTokenAmount, bytes bridgeData) bridgeOrder, uint256 fillAmount)',
            ],
            [
              {
                side: fqtData.side,
                sellToken: fqtData.sellToken,
                buyToken: fqtData.buyToken,
                bridgeOrder,
                fillAmount: fqtData.fillAmount,
              },
            ]
          );
        }
        transformations.push({
          transformer: transformerParams.transformer,
          data,
        });
        break;
      }
      default: {
        throw new Error(
          `unknown transformer type: ${transformerParams.transformerType}`
        );
      }
    }
  }
  return utils.defaultAbiCoder.encode(
    ['tuple(address transformer,bytes data)[]'],
    [transformations]
  );
}

export function getErc20BridgeSourceToBridgeSource(source: ProtocolId): string {
  switch (source) {
    case ProtocolId.Balancer:
      return encodeBridgeSourceId(ProtocolId.Balancer, 'Balancer');
    case ProtocolId.BalancerV2:
      return encodeBridgeSourceId(ProtocolId.BalancerV2, 'BalancerV2');
    case ProtocolId.Bancor:
      return encodeBridgeSourceId(ProtocolId.Bancor, 'Bancor');
    case ProtocolId.Curve:
      return encodeBridgeSourceId(ProtocolId.Curve, 'Curve');
    case ProtocolId.CurveV2:
      return encodeBridgeSourceId(ProtocolId.CurveV2, 'CurveV2');
    case ProtocolId.UniswapV2:
      return encodeBridgeSourceId(ProtocolId.UniswapV2, 'UniswapV2');
    case ProtocolId.UniswapV3:
      return encodeBridgeSourceId(ProtocolId.UniswapV3, 'UniswapV3');
    case ProtocolId.DODO:
      return encodeBridgeSourceId(ProtocolId.DODO, 'DODO');
    case ProtocolId.DODOV2:
      return encodeBridgeSourceId(ProtocolId.DODOV2, 'DODOV2');
    case ProtocolId.Kyber:
      return encodeBridgeSourceId(ProtocolId.Kyber, 'Kyber');
    case ProtocolId.MakerPSM:
      return encodeBridgeSourceId(ProtocolId.MakerPSM, 'MakerPSM');
    case ProtocolId.ZeroX:
      return encodeBridgeSourceId(ProtocolId.ZeroX, 'ZeroX');
    default:
      throw new Error(`unsupported protocol: ${source}`);
  }
}

export function encodeBridgeSourceId(
  protocol: ProtocolId,
  name: string
): string {
  const nameBuf = Buffer.from(name);
  if (nameBuf.length > 16) {
    throw new Error(
      `"${name}" is too long to be a bridge source name (max of 16 ascii chars)`
    );
  }
  return utils.hexlify(
    utils.concat([
      utils.zeroPad(utils.arrayify(utils.hexlify(protocol)), 16),
      utils.arrayify(utils.formatBytes32String(name)).slice(0, 16),
    ])
  );
}

export function createMultiHopSellSubcalls(
  tokens: string[],
  params: QuoteParams[],
  transformerAddr: string
) {
  const max = ethers.constants.MaxUint256;
  const subcalls = [];
  for (let i = 0; i < params.length; ++i) {
    const transformations = createTransformations(
      [tokens[i], tokens[i + 1]],
      params[i],
      transformerAddr
    );
    const subcall: MultiHopSellSubcall = {
      id: MultiplexSubcallType.BatchSell,
      data: {
        calls: [
          {
            id: MultiplexSubcallType.TransformERC20,
            sellAmount: max,
            data: transformations,
          },
        ],
      },
    };
    subcalls.push(subcall);
  }
  return subcalls;
}

export function createBatchSellSubcalls(
  tokenPair: [string, string],
  params: QuoteParams[],
  transformerAddr: string,
  percents: number[],
  sellAmount: BigNumber
) {
  const batchSellSubcalls: BatchSellSubcall[] = [];
  for (let i = 0; i < params.length; ++i) {
    const param = params[i];
    const transformations = createTransformations(
      tokenPair,
      param,
      transformerAddr
    );
    batchSellSubcalls.push({
      id: MultiplexSubcallType.TransformERC20,
      sellAmount: sellAmount.mul(percents[i]).div(100),
      // use quote directly or multihop for more complex route
      data: transformations,
    });
  }
  return batchSellSubcalls;
}

export function createBridgeOrder(params: QuoteParams) {
  const max = ethers.constants.MaxUint256;
  const source = getErc20BridgeSourceToBridgeSource(
    Protocol2Id[params.protocol]
  );
  const takerTokenAmount = max;
  const makerTokenAmount = 0;
  const order = {
    source,
    takerTokenAmount,
    makerTokenAmount,
    bridgeData: params,
  };
  return order;
}

export function createTransformations(
  tokenPair: [string, string],
  params: QuoteParams,
  transformerAddr: string
) {
  const max = ethers.constants.MaxUint256;
  const bridgeOrder = createBridgeOrder(params);

  const data: TransformData = {
    side: TradeType.EXACT_INPUT,
    sellToken: tokenPair[0],
    buyToken: tokenPair[1],
    orderType: OrderType.Bridge,
    bridgeOrder,
    fillAmount: max,
  };

  const transformations: TransformerParams[] = [];
  transformations.push({
    transformerType: TransformerType.FillQuoteTransformer,
    transformer: transformerAddr,
    transformData: data,
  });
  return transformations;
}
