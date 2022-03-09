import { BytesLike } from 'ethers';

export interface BalancerV2PoolInfo {
  poolId: BytesLike;
  vault: string;
}
