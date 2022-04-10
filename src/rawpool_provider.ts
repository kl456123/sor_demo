import fs from 'fs';
import path from 'path';

import _ from 'lodash';
import NodeCache from 'node-cache';

import { globalBlacklist } from './blacklist';
import { PROTOCOLSTRMAP } from './constants';
import { Token, TokenAmount } from './entities';
import { PoolV2 as Pool } from './entitiesv2';
import { logger } from './logging';
import { BalancerPoolProvider } from './markets/balancer_subgraph_provider';
import { BalancerV2PoolProvider } from './markets/balancerv2_subgraph_provider';
import {
  CurvePoolProvider,
  CurveSubgraphPoolProvider,
} from './markets/curve_pool_provider';
import { CurveV2PoolProvider } from './markets/curvev2_pool_provider';
import { DODOPoolProvider } from './markets/dodo_provider';
import { DODOV2SubgraphPoolProvider } from './markets/dodov2_subgraph_provider';
import { UniswapV2StaticFileSubgraphProvider } from './markets/uniswapv2_subgraph_provider';
import { UniswapV3SubgraphPoolProvider } from './markets/uniswapv3_subgraph_provider';
import { ChainId, Protocol, ProviderConfig, RawPool } from './types';

export interface IRawPoolProvider {
  getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<RawPool[]>;
}

export type PoolAccessor = {
  getPool: (tokenA: Token, tokenB: Token) => Pool[];
  getPoolByAddress: (address: string) => Pool | undefined;
  getAllPools: () => Pool[];
};

type TokenPair = [Token, Token];

export class RawPoolProvider {
  protected uniswapV2SubgraphPoolProvider: IRawPoolProvider;
  protected uniswapV3SubgraphPoolProvider: IRawPoolProvider;
  protected curvePoolProvider: IRawPoolProvider;
  protected curveV2PoolProvider: IRawPoolProvider;
  protected balancerV2PoolProvider: IRawPoolProvider;
  protected dodoV2PoolProvider: IRawPoolProvider;
  protected dodoPoolProvider: IRawPoolProvider;
  protected balancerPoolProvider: IRawPoolProvider;
  private nodecache: NodeCache;
  protected blacklist: string[] = [];
  constructor(public readonly chainId: ChainId) {
    this.uniswapV2SubgraphPoolProvider =
      new UniswapV2StaticFileSubgraphProvider();
    this.balancerV2PoolProvider = new BalancerV2PoolProvider(chainId);
    this.balancerPoolProvider = new BalancerPoolProvider();
    this.curvePoolProvider = new CurvePoolProvider();
    const curvePoolProvider = new CurveSubgraphPoolProvider(chainId);
    curvePoolProvider;
    this.uniswapV3SubgraphPoolProvider = new UniswapV3SubgraphPoolProvider(
      chainId
    );
    this.dodoV2PoolProvider = new DODOV2SubgraphPoolProvider(chainId);
    this.dodoPoolProvider = new DODOPoolProvider();
    this.curveV2PoolProvider = new CurveV2PoolProvider();
    this.nodecache = new NodeCache({ stdTTL: 3600, useClones: false });

    // blacklist
    const blacklistPath = '../data/blacklist.json';
    if (fs.existsSync(blacklistPath)) {
      this.blacklist = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, blacklistPath), 'utf8')
      ) as string[];
      this.blacklist.forEach(t => globalBlacklist().add(t));
    }
  }

  public async getRawPools(protocols: Protocol[]): Promise<RawPool[]> {
    const poolsFetchPromises = [];
    for (const protocol of protocols) {
      switch (protocol) {
        case Protocol.UniswapV2:
          poolsFetchPromises.push(
            this.uniswapV2SubgraphPoolProvider.getPools()
          );
          break;
        case Protocol.UniswapV3:
          poolsFetchPromises.push(
            this.uniswapV3SubgraphPoolProvider.getPools()
          );
          break;
        case Protocol.Curve:
          poolsFetchPromises.push(this.curvePoolProvider.getPools());
          break;
        case Protocol.BalancerV2:
          poolsFetchPromises.push(this.balancerV2PoolProvider.getPools());
          break;
        case Protocol.DODOV2:
          poolsFetchPromises.push(this.dodoV2PoolProvider.getPools());
          break;
        case Protocol.DODO:
          poolsFetchPromises.push(this.dodoPoolProvider.getPools());
          break;
        case Protocol.CurveV2:
          poolsFetchPromises.push(this.curveV2PoolProvider.getPools());
          break;
        case Protocol.Balancer:
          poolsFetchPromises.push(this.balancerPoolProvider.getPools());
          break;
        default:
          throw new Error(
            `unsupported protocol: ${protocol} when get rawPools!`
          );
      }
    }

    const poolsFetch = await Promise.all(poolsFetchPromises);
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
