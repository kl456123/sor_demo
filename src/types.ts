import { BigNumber } from 'ethers';

import { Route, TokenAmount } from './entities';

export enum ChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
  BSC = 5,
  POLYGON = 6,
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
  // need to determined lately
  Unknow = 'Unknow',
  Curve = 'Curve',
  UniswapV2 = 'UniswapV2',
  Balancer = 'Balancer',
  Kyber = 'Kyber',
  DODO = 'DODO',
  DODOV2 = 'DODOV2',
  Bancor = 'Bancor',
  MakerPSM = 'MakerPSM',
  BalancerV2 = 'BalancerV2',
  UniswapV3 = 'UniswapV3',
  KyberDMM = 'KyberDMM',
  CurveV2 = 'CurveV2',

  SushiSwap = 'SushiSwap',
  Eth2Dai = 'Eth2Dai',
  ZeroX = 'ZeroX', // limit order

  // BSC only
  PancakeSwapV2 = 'PancakeSwapV2',
  BakerySwap = 'BakerySwap',

  // Polygon only
  QuickSwap = 'QuickSwap',
}

// The order of all protocols should be in consistent with the contracts code
export enum ProtocolId {
  // need to determined lately
  Unknow,
  Curve,
  UniswapV2,
  Balancer,
  Kyber,
  DODO,
  DODOV2,
  Bancor,
  MakerPSM,
  BalancerV2,
  UniswapV3,
  KyberDMM,
  CurveV2,

  SushiSwap,
  Eth2Dai,
  ZeroX, // limit order

  // BSC only
  PancakeSwapV2,
  BakerySwap,

  // Polygon only
  QuickSwap,
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

export type RawToken = {
  address: string;
  symbol: string;
};

export type RawPool = {
  protocol: string;
  id: string;
  tokens: RawToken[];
  reserve: number;
  poolData?: unknown;
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
  blockNumber: number;
  maxSplits: number;
  minSplits: number;
  firstDistributionPercent: number;
  secondDistributionPercent: number;
  maxSwapsPerPath: number;
  poolSelections: Partial<ProtocolPoolSelection>;
  includedSources: Protocol[];
  excludedSources: Protocol[];
};

// sample queries on single route for many quote amounts
export type AmountQuote = { amount: TokenAmount; quote?: BigNumber };
export type RouteWithQuotes = [Route, AmountQuote[]];

// common
export enum Rounding {
  ROUNDING_DOWN = 0,
  ROUNDING_HALF_UP = 1,
  ROUNDING_UP = 2,
}

// types for server request and response
export type QuoteParam = {
  // basic params for trading
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  // opts for routing algorithm
  protocols?: Protocol[];
  maxSwapsPerPath?: number;
  maxSplits?: number;
};

export type QuoteResponse = {
  fromToken: string;
  toToken: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  protocols: string;
};

export type SwapParam = {
  // basic params for trading
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  slippage: string;
  protocols?: Protocol[];
  dstReceiver?: string;
  maxSwapsPerPath?: number;
  maxSplits?: number;
  allPartialFill?: boolean;
};

export type SwapResponse = {
  fromToken: string;
  toToken: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  data: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  from: string;
  to: string;
};
