import fs from 'fs';
import path from 'path';

import _ from 'lodash';
import NodeCache from 'node-cache';

import { globalBlacklist } from './blacklist';
import { PROTOCOLSTRMAP } from './constants';
import { Database } from './database';
import { Token, TokenAmount } from './entities';
import { PoolV2 as Pool } from './entitiesv2';
import { logger } from './logging';
import { ChainId, Protocol, ProviderConfig, RawPool, RawToken } from './types';

export interface IRawPoolProvider {
  getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<RawPool[]>;
}

export enum DatabaseProtocol {
  UniswapV2,
  UniswapV3,
  Curve,
  CurveV2,
  Balancer,
  BalancerV2,
  Bancor,
  Kyber,
  DODO,
  DODOV2,
}

const DatabaseMap: Record<DatabaseProtocol, Protocol> = {
  [DatabaseProtocol.UniswapV2]: Protocol.UniswapV2,
  [DatabaseProtocol.UniswapV3]: Protocol.UniswapV3,
  [DatabaseProtocol.Curve]: Protocol.Curve,
  [DatabaseProtocol.CurveV2]: Protocol.CurveV2,
  [DatabaseProtocol.Balancer]: Protocol.Balancer,
  [DatabaseProtocol.BalancerV2]: Protocol.BalancerV2,
  [DatabaseProtocol.Bancor]: Protocol.Bancor,
  [DatabaseProtocol.Kyber]: Protocol.Kyber,
  [DatabaseProtocol.DODO]: Protocol.DODO,
  [DatabaseProtocol.DODOV2]: Protocol.DODOV2,
};
type DatabasePool = {
  protocol: DatabaseProtocol;
  id: string;
  tokens: { id: string; symbol: string }[];
  poolData?: unknown;
  latestDailyVolumeUSD: string;
};

type DatabaseToken = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type PoolAccessor = {
  getPool: (tokenA: Token, tokenB: Token) => Pool[];
  getPoolByAddress: (address: string) => Pool | undefined;
  getAllPools: () => Pool[];
};

type TokenPair = [Token, Token];

export class RawPoolProvider {
  private nodecache: NodeCache;
  protected blacklist: string[] = [];
  protected cachedPools: RawPool[] = [];
  protected cachedTokens: { [address: string]: Token } = {};
  protected poolCollectionName: string;
  protected tokenCollectionName: string;
  constructor(public readonly chainId: ChainId, protected database: Database) {
    this.nodecache = new NodeCache({ stdTTL: 3600, useClones: false });

    // blacklist
    const blacklistPath = '../data/blacklist.json';
    if (fs.existsSync(blacklistPath)) {
      this.blacklist = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, blacklistPath), 'utf8')
      ) as string[];
      this.blacklist.forEach(t => globalBlacklist().add(t));
    }
    this.poolCollectionName = 'pools';
    this.tokenCollectionName = 'tokens';
  }

  public async fetchPoolsFromDatabase(protocols: Protocol[]) {
    protocols;
    const poolsFetch = await this.database.loadMany<DatabasePool>(
      {
        latestDailyVolumeUSD: { $gt: '0' },
      },
      this.poolCollectionName
    );
    const pools: RawPool[] = poolsFetch.map(poolFetch => {
      const tokens: RawToken[] = poolFetch.tokens.map(token => ({
        address: token.id.toLowerCase(),
        symbol: token.symbol,
      }));
      return {
        protocol: DatabaseMap[poolFetch.protocol],
        id: poolFetch.id.toLowerCase(),
        tokens,
        reserve: parseFloat(poolFetch.latestDailyVolumeUSD),
        poolData: poolFetch.poolData,
      };
    });
    return pools;
  }

  public async fetchTokensFromDatabase() {
    const tokensFetch = await this.database.loadMany<DatabaseToken>(
      {},
      this.tokenCollectionName
    );
    const tokens = tokensFetch.map(
      rawToken =>
        new Token({
          chainId: this.chainId,
          address: rawToken.id.toLowerCase(),
          decimals: rawToken.decimals,
          name: rawToken.name,
          symbol: rawToken.symbol,
        })
    );
    const addressToToken: { [address: string]: Token } = {};
    tokens.forEach(token => {
      addressToToken[token.address.toLowerCase()] = token;
    });
    return addressToToken;
  }

  public async getTokens(): Promise<{ [address: string]: Token }> {
    if (Object.keys(this.cachedTokens).length) {
      return this.cachedTokens;
    }
    const tokensFetch = await this.fetchTokensFromDatabase();
    // cache
    this.cachedTokens = tokensFetch;
    return tokensFetch;
  }

  public async getRawPools(protocols: Protocol[]): Promise<RawPool[]> {
    if (this.cachedPools.length) {
      return this.cachedPools;
    }
    const poolsFetch = await this.fetchPoolsFromDatabase(protocols);

    const allRawPools: RawPool[] = _.flatMap(poolsFetch).filter(
      rawPool => !this.blacklist.includes(rawPool.id)
    );

    // cache
    allRawPools
      .filter(rawPool => rawPool.protocol === Protocol.UniswapV2)
      .forEach(rawPool => {
        const key = RawPoolProvider.calcCacheKeyByString(
          rawPool.tokens[0].address,
          rawPool.tokens[1].address,
          this.chainId
        );
        this.nodecache.set(key, rawPool);
      });
    this.cachedPools = allRawPools;
    return allRawPools;
  }

  public getPools(
    rawPools: RawPool[],
    tokenAccessor: Record<string, Token>
  ): PoolAccessor {
    const poolAddressToPool: { [address: string]: Pool } = {};
    const tokensTopool: Record<string, string[]> = {};
    for (const rawPool of rawPools) {
      const tokens = rawPool.tokens.map(token => tokenAccessor[token.address]);
      let skip = false;
      for (const token of tokens) {
        if (!token) {
          logger.info(`Dropping candidate pool for ${rawPool.id}`);
          skip = true;
          break;
        }
      }
      if (skip) {
        continue;
      }
      const tokensAmount = tokens.map(token => new TokenAmount(token, 10));
      const pool = new Pool(
        tokensAmount,
        rawPool.id,
        PROTOCOLSTRMAP[rawPool.protocol],
        rawPool.poolData
      );
      poolAddressToPool[rawPool.id] = pool;
      const tokenPairs: TokenPair[] = _.flatMap(tokens, (tokenA): TokenPair[] =>
        tokens.map(tokenB => [tokenA, tokenB])
      ).filter(([tokenA, tokenB]) => !tokenA.equals(tokenB));

      _.forEach(tokenPairs, (tokens: TokenPair) => {
        const key = RawPoolProvider.calcCacheKey(tokens[0], tokens[1]);
        if (!tokensTopool[key]) {
          tokensTopool[key] = [];
        }
        tokensTopool[key].push(pool.id);
      });
    }

    return {
      getPool: (tokenA: Token, tokenB: Token): Pool[] => {
        const key = RawPoolProvider.calcCacheKey(tokenA, tokenB);
        const poolAddresses = tokensTopool[key];
        return _(poolAddresses)
          .map(addr => poolAddressToPool[addr])
          .compact()
          .value();
      },
      getPoolByAddress: (address: string): Pool | undefined => {
        return poolAddressToPool[address];
      },
      getAllPools: (): Pool[] => {
        return Object.values(poolAddressToPool);
      },
    };
  }

  static calcCacheKey(tokenA: Token, tokenB: Token) {
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];
    return `${
      token0.chainId
    }/${token0.address.toLowerCase()}/${token1.address.toLowerCase()}`;
  }

  static calcCacheKeyByString(
    tokenA: string,
    tokenB: string,
    chainId: ChainId
  ) {
    [tokenA, tokenB] = [tokenA.toLowerCase(), tokenB.toLowerCase()];
    const [token0, token1] =
      tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
    return `${chainId}/${token0}/${token1}`;
  }

  public getPoolAddress(tokenA: Token, tokenB: Token) {
    return this.getPoolAddressByString(tokenA.address, tokenB.address);
  }

  public getPoolAddressByString(tokenA: string, tokenB: string) {
    const cacheKey = RawPoolProvider.calcCacheKeyByString(
      tokenA,
      tokenB,
      this.chainId
    );
    const cachedAddress = this.nodecache.get<RawPool>(cacheKey);
    if (!cachedAddress) {
      logger.warn(`cannot find pool address for ${tokenA}/${tokenB}`);
      return null;
    }

    return cachedAddress;
  }
}
