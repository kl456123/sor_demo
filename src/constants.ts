import { FeeAmount } from '@uniswap/v3-sdk';

import { Protocol, RoutingConfig } from './types';

export const DEFAULT_ROUTER_CONFIG: RoutingConfig = {
  poolSelections: {
    topN: 10,
    topNSecondHop: 6,
    topNTokenInOut: 8,

    topNDirectSwaps: 1,
    topNWithEachBaseToken: 2,
    topNWithBaseToken: 5,
    topNWithBaseTokenInSet: false,
  },
  maxSwapsPerPath: 3,
  minSplits: 1,
  maxSplits: 5,
  distributionPercent: 5,
  includedSources: [],
  excludedSources: [],
};

// TODO (change hardcode style)
export const PROTOCOLSTRMAP: { [name: string]: Protocol } = {
  Uniswap_V2: Protocol.UniswapV2,
  SushiSwap: Protocol.SushiSwap,
  Eth2Dai: Protocol.Eth2Dai,
  Uniswap_V3_LOW: Protocol.UniswapV3_LOW,
  Uniswap_V3_HIGH: Protocol.UniswapV3_HIGH,
  Uniswap_V3_LOWEST: Protocol.UniswapV3_LOWEST,
  Uniswap_V3_MEDIUM: Protocol.UniswapV3_MEDIUM,
  ZeroX: Protocol.ZeroX,
  Curve: Protocol.Curve,
};

export const ProtocolForFeeAmount: { [protocol in Protocol]?: FeeAmount } = {
  [Protocol.UniswapV3_LOW]: FeeAmount.LOW,
  [Protocol.UniswapV3_LOWEST]: FeeAmount.LOWEST,
  [Protocol.UniswapV3_MEDIUM]: FeeAmount.MEDIUM,
  [Protocol.UniswapV3_HIGH]: FeeAmount.HIGH,
};

export const uniswapV3Protocols = [
  Protocol.UniswapV3_LOW,
  Protocol.UniswapV3_HIGH,
  Protocol.UniswapV3_LOWEST,
  Protocol.UniswapV3_MEDIUM,
];
