import { BigNumber } from 'ethers';

import { Route, RouteWithValidQuote, TokenAmount } from './entities';

export enum ChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
  BSC = 5,
  POLYGON=6,
}

export enum ChainName {
  MAINNET = 'mainnet',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
}

export enum TradeType {
  EXACT_INPUT = 0,
  EXACT_OUTPUT = 1,
}

// provider supporting cache
export type ProviderConfig = {
  blockNumber?: number | Promise<number>;
};

export type LocalCacheEntry<T> = {
  entry: T;
  blockNumber?: number;
};

// dex sources to aggregate.

export enum Protocol {
  UniswapV2 = 'Uniswap_V2',
  // difference uniswapv3 by fee amounts
  UniswapV3_LOWEST = 'Uniswap_V3_LOWEST',
  UniswapV3_LOW = 'Uniswap_V3_LOW',
  UniswapV3_MEDIUM = 'Uniswap_V3_MEDIUM',
  UniswapV3_HIGH = 'Uniswap_V3_HIGH',
  SushiSwap = 'SushiSwap',
  Curve = 'Curve',
  Eth2Dai = 'Eth2Dai',
  ZeroX = 'ZeroX', // limit order

  // BSC only
  PancakeSwapV2 = 'PancakeSwap_V2',
  BakerySwap = 'BakerySwap',

  // Polygon only
  QuickSwap = 'QuickSwap',
  // need to determined lately
  Unknow = 'Unknow',
  // composed liquidity pool used to quote for multi-hop path
  MultiHop = 'MultiHop',
}

// subgraph to fetch pools for specific sources
//

export type SubgraphPool = {
  id: string;
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
  supply: number;
  reserve: number;
  protocol: string;
};

////////////////////////////////
// optimized route with quotes

export type ProtocolPoolSelection = {
  topN: number;
  topNDirectSwaps: number;
  topNSecondHop: number;
  topNWithEachBaseToken: number;
  topNWithBaseToken: number;
  topNTokenInOut: number;
  topNWithBaseTokenInSet: boolean;
};

export type SwapConfig = {
  recipient: string;
  slippageTolerance: number;
  deadline: number;
};

export type RoutingConfig = {
  blockNumber?: number;
  maxSplits: number;
  minSplits: number;
  distributionPercent: number;
  maxSwapsPerPath: number;
  poolSelections: ProtocolPoolSelection;
  includedSources: Protocol[];
  excludedSources: Protocol[];
};

// sample queries on single route for many quote amounts
export type AmountQuote = { amount: TokenAmount; quote?: BigNumber };
export type RouteWithQuotes = [Route, AmountQuote[]];

export type SwapRoute = {
  routes: RouteWithValidQuote[];
  blockNumber: number;
  quote: TokenAmount;
  quoteAdjustedForGas: TokenAmount;
};

export type RoutesByProtocol = { [protocol in Protocol]?: Route[] };

// common
export enum Rounding {
  ROUNDING_DOWN = 0,
  ROUNDING_HALF_UP = 1,
  ROUNDING_UP = 2,
}
