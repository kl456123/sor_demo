import { BigNumber } from 'ethers';
import NodeCache from 'node-cache';

import { Pool, Token, TokenAmount } from './entities';
import { logger } from './logging';
import { ChainId, Protocol, ProviderConfig } from './types';

export type PoolInfoByProtocol = {
  protocol: Protocol;
  address: string;
  tokens: string[];
};

export interface IPoolProvider {
  getPool(
    tokenPairs: [Token, Token][],
    poolsInfo: PoolInfoByProtocol[],
    providerConfig?: ProviderConfig
  ): Promise<PoolAccessor>;

  // return sorted token pairs
  getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    protocol: Protocol
  ): { poolAddress: string; token0: Token; token1: Token };
}

export type PoolAccessor = {
  getPool: (
    tokenA: Token,
    tokenB: Token,
    protocol: Protocol
  ) => Pool | undefined;
  getPoolByAddress: (address: string) => Pool | undefined;
  getAllPools: () => Pool[];
};

export class PoolProvider implements IPoolProvider {
  private nodecache: NodeCache;
  constructor(public readonly chainId: ChainId) {
    this.nodecache = new NodeCache({ stdTTL: 3600, useClones: false });
  }

  public async getPool(
    tokenPairs: [Token, Token][],
    poolsInfo: PoolInfoByProtocol[],
    providerConfig?: ProviderConfig
  ): Promise<PoolAccessor> {
    // only used for deduplication
    const poolAddressSet: Set<string> = new Set<string>();
    const sortedPoolAddresses: string[] = [];
    const sortedTokenPairs: Array<[Token, Token]> = [];
    const sortedProtocols: Protocol[] = [];
    const poolAddressToPool: { [address: string]: Pool } = {};

    // cache pool address first
    this.cachePoolsInfo(poolsInfo);

    for (let i = 0; i < tokenPairs.length; ++i) {
      const [tokenA, tokenB] = tokenPairs[i];
      const protocol = poolsInfo[i].protocol;
      const { poolAddress, token0, token1 } = this.getPoolAddress(
        tokenA,
        tokenB,
        protocol
      );
      if (poolAddressSet.has(poolAddress)) {
        continue;
      }
      poolAddressSet.add(poolAddress);
      sortedTokenPairs.push([token0, token1]);
      sortedPoolAddresses.push(poolAddress);
      sortedProtocols.push(protocol);
    }

    logger.debug(
      `Deduped from ${tokenPairs.length} down to ${poolAddressSet.size}`
    );

    logger.info(
      `Got pools info from on-chain ${
        providerConfig ? `blockNumber: ${providerConfig.blockNumber}` : ''
      }`
    );

    for (let i = 0; i < sortedPoolAddresses.length; ++i) {
      const [token0, token1] = sortedTokenPairs[i];
      const poolAddress = sortedPoolAddresses[i]!;
      // mock reserve data
      const one = BigNumber.from(1);
      const pool = new Pool(
        [new TokenAmount(token0, one), new TokenAmount(token1, one)],
        sortedProtocols[i]
      );

      poolAddressToPool[poolAddress] = pool;
    }

    return {
      getPool: (
        tokenA: Token,
        tokenB: Token,
        protocol: Protocol
      ): Pool | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB, protocol);
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
    tokenB: Token,
    protocol: Protocol
  ): { poolAddress: string; token0: Token; token1: Token } {
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];
    const cacheKey = PoolProvider.calcCacheKey(
      token0.address,
      token1.address,
      this.chainId,
      protocol
    );
    const cachedAddress = this.nodecache.get<string>(cacheKey);
    if (!cachedAddress) {
      throw new Error(
        `cannot find pool address for ${tokenA}/${tokenB} in ${protocol}`
      );
    }

    return { poolAddress: cachedAddress, token0, token1 };
  }
  static calcCacheKey(
    token0: string,
    token1: string,
    chainId: ChainId,
    protocol: Protocol
  ) {
    return `${chainId}/${protocol}/${token0}/${token1}`;
  }

  private cachePoolsInfo(poolsInfo: PoolInfoByProtocol[]) {
    poolsInfo.forEach(poolInfo => {
      // sort token address first
      const [tokenA, tokenB] = poolInfo.tokens;
      const [token0, token1] =
        tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
      const cacheKey = PoolProvider.calcCacheKey(
        token0,
        token1,
        this.chainId,
        poolInfo.protocol
      );

      const cachedAddress = this.nodecache.get<string>(cacheKey);
      if (!cachedAddress) {
        this.nodecache.set(cacheKey, poolInfo.address);
      } else if (cachedAddress !== poolInfo.address) {
        // may be bug!
        logger.warn(
          `want to update pool address from ${cachedAddress} to ${poolInfo.address}`
        );
      }
    });
  }
}
