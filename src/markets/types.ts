import { BigNumber } from 'ethers';

export interface UniswapV2PoolData {
  reserve0: BigNumber;
  reserve1: BigNumber;
}

export interface UniswapV3PoolData {
  feeTier: number;
}

export interface BalancerV2PoolData {
  id: string;
}

export interface CurvePoolData {
  isMeta: boolean;
  isLending: boolean;
  wrappedToken: string[];
}
