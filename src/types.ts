export enum ChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
}

export enum ChainName {
  MAINNET = 'mainnet',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
}

// trading entities
export type Token = {
  name: string;
  chainId: number;
  address: string;
  decimals: number;
};

export type Pool = {
  id: string;
  chainId: number;
  address: string;
};

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

export enum ERC20BridgeSource {
  UniswapV2 = 'Uniswap_V2',
  SushiSwap = 'SushiSwap',
  Curve = 'Curve',

  // BSC only
  PancakeSwapV2 = 'PancakeSwap_V2',
  BakerySwap = 'BakerySwap',

  // Polygon only
  QuickSwap = 'QuickSwap',
}

// subgraph to fetch pools for specific sources
//

export type SubgraphPool = {
  id: string;
  token0: {
    id: string;
  };
  token1: {
    id: string;
  };
  supply: number;
  reserve: number;
};

////////////////////////////////
// optimized route with quotes

export type ProtocolPoolSelection = {
  topN: number;
  topNDirectSwaps: number;
  topNSecondHop: number;
  topNWithEachBaseToken: number;
  topNWithBaseToken: number;
  topNWithBaseTokenInSet: number;
};

export type SwapConfig = {
  recipient: string;
  slippageTolerance: number;
  deadline: number;
};

export type RoutingConfig = {
  maxSplits: number;
  minSplits: number;
  distributionPercent: number;
  maxSwapsPerPath: number;
  poolSelections: ProtocolPoolSelection;
};

export type Route = {
  tokenIn: string;
  paths: string[];
};

export type RouteWithValidQuote = {
  percent: number;
  amount: number;
  route: Route;
};

export type SwapRoute = {
  routes: RouteWithValidQuote[];
  blockNumber: number;
  quote: number;
  quoteGasAdjusted: number;
};

// common
export enum Rounding {
  ROUNDING_DOWN = 0,
  ROUNDING_HALF_UP = 1,
  ROUNDING_UP = 2,
}
