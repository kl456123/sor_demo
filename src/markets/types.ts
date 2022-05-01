import { BigNumber, BytesLike } from 'ethers';

export interface BalancerV2PoolInfo {
  poolId: BytesLike;
  vault: string;
}

export interface UniswapV2PoolData {
  reserve0: BigNumber;
  reserve1: BigNumber;
}

export interface UniswapV3PoolData {
  feeTier: number;
}
