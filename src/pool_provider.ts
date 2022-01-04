import { BigNumber } from 'ethers';
import { NodeCache } from 'node-cache';

import { Pool, Token, TokenAmount } from './entities';
import { logger } from './logging';
import { ProviderConfig } from './types';

export interface IPoolProvider {
  getPool(
    tokenPairs: [Token, Token][],
    providerConfig?: ProviderConfig
  ): Promise<PoolAccessor>;

  // return sorted token pairs
  getPoolAddress(
    tokenA: Token,
    tokenB: Token
  ): { poolAddress: string; token0: Token; token1: Token };
}

export type PoolAccessor = {
  getPool: (tokenA: Token, tokenB: Token) => Pool | undefined;
  getPoolByAddress: (address: string) => Pool | undefined;
  getAllPools: () => Pool[];
};

export class PoolProvider implements IPoolProvider {
  private nodecache: NodeCache;
  constructor() {
    this.nodecache = new NodeCache({ stdTTL: 3600, useClones: false });
  }

  public async getPool(
    tokenPairs: [Token, Token][],
    providerConfig?: ProviderConfig
  ): Promise<PoolAccessor> {
    // only used for deduplication
    const poolAddressSet: Set<string> = new Set<string>();
    const sortedPoolAddresses: string[] = [];
    const sortedTokenPairs: Array<[Token, Token]> = [];
    const poolAddressToPool: { [address: string]: Pool } = {};

    for (const tokenPair of tokenPairs) {
      const [tokenA, tokenB] = tokenPair;
      const { poolAddress, token0, token1 } = this.getPoolAddress(
        tokenA,
        tokenB
      );
      if (poolAddressSet.has(poolAddress)) {
        continue;
      }
      poolAddressSet.add(poolAddress);
      sortedTokenPairs.push([token0, token1]);
      sortedPoolAddresses.push(poolAddress);
    }

    logger.debug(
      `Deduped from ${tokenPairs.length} down to ${poolAddressSet.size}`
    );

    for (let i = 0; i < sortedPoolAddresses.length; ++i) {
      const [token0, token1] = sortedTokenPairs[i];
      const poolAddress = sortedPoolAddresses[i]!;
      // mock reserve data
      const zero = BigNumber.from(0);
      const pool = new Pool([
        new TokenAmount(token0, zero),
        new TokenAmount(token1, zero),
      ]);

      poolAddressToPool[poolAddress] = pool;
    }

    return {
      getPool: (tokenA: Token, tokenB: Token): Pool | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB);
        return poolAddressToPool[poolAddress];
      },
      getPoolByAddress: (address: string): Pool | undefined => {
        return poolAddressToPool[address];
      },
      getAllPools: (): Pool[] => {
        return Object.values(poolAddressToPool);
      },
    };
  }

  public getPoolAddress(
    tokenA: Token,
    tokenB: Token
  ): { poolAddress: string; token0: Token; token1: Token } {
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];
    const cacheKey = ``;
    const cachedAddress = this.nodecache.get<string>(cacheKey);
    if (cachedAddress) {
      return { poolAddress: cachedAddress, token0, token1 };
    }

    const poolAddress = '';
    this.nodecache.set(poolAddress);

    return { poolAddress, token0, token1 };
  }
}
