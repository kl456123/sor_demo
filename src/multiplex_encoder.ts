import { BigNumberish, BytesLike, utils } from 'ethers';

import { ICurve__factory } from '../typechain-types/factories/ICurve__factory';
import { Quoter__factory } from '../typechain-types/factories/Quoter__factory';

import {
  DODOV1_CONFIG_BY_CHAIN_ID,
  DODOV2_FACTORIES_BY_CHAIN_ID,
} from './addresses';
import { getCurveInfosForPool } from './markets/curve';
import { ChainId, Protocol } from './types';

export enum MultiplexSubcallType {
  Invalid,
  TransformERC20,
  BatchSell,
  MultiHopSell,
  Quoter,
}

export type QuoteParams =
  | QuoteFromBalancerV2Params
  | QuoteFromUniswapV3Params
  | QuoteFromUniswapV2Params
  | QuoteFromCurveParmas
  | QuoteFromDODOParams
  | QuoteFromDODOV2Params;

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
  protocol: Protocol.Curve;
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
};

export type QuoteFromDODOV2Params = {
  protocol: Protocol.DODOV2;
  registry: string;
  offset: BigNumberish;
  takerToken: string;
  makerToken: string;
};

export type BatchSellSubcall = {
  id: MultiplexSubcallType;
  sellAmount: BigNumberish;
  data: QuoteParams | MultiHopSellParams;
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
  recipient: string;
};

export type MultiHopSellParams = {
  tokens: string[];
  calls: MultiHopSellSubcall[];
  recipient: string;
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
      const fromTokenIdx = curveInfo.tokens.indexOf(params.fromToken);
      const toTokenIdx = curveInfo.tokens.indexOf(params.toToken);
      const curveInterface = ICurve__factory.createInterface();
      const paramsData = utils.defaultAbiCoder.encode(
        [
          'tuple(address poolAddress,bytes4 sellQuoteFunctionSelector,bytes4 buyQuoteFunctionSelector,uint256 fromTokenIdx,uint256 toTokenIdx)',
        ],
        [
          {
            poolAddress: curveInfo.poolAddress,
            sellQuoteFunctionSelector:
              curveInterface.getSighash('get_dy_underlying'),
            buyQuoteFunctionSelector: '0x00000000',
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
      const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET]!;
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
      const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET]![0];
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
  }
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
      default:
        throw new Error(`Unsupported MultiplexSubcallType: ${call.id}`);
    }
    encodedCalls.push(encodedCall);
  }
  return encodedCalls;
}
