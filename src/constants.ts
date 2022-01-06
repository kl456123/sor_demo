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
};
