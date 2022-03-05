import fs from 'fs';
import path from 'path';

import retry from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';
import NodeCache from 'node-cache';


import { BALANCER_V2_SUBGRAPH_URL_BY_CHAIN } from './addresses';
import { PROTOCOLSTRMAP } from './constants';
import { Token, TokenAmount } from './entities';
import { PoolV2 as Pool } from './entitiesv2';
import { logger } from './logging';
import { CurveInfo, MAINNET_CURVE_INFOS } from './markets/curve';
import { ChainId, Protocol, ProviderConfig, RawPool, RawToken } from './types';

const SUBGRAPH_URL_BY_CHAIN: { [chainId in ChainId]?: string } = {
  [ChainId.MAINNET]:
    'https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2',
  [ChainId.RINKEBY]:
    'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v2-rinkeby',
};
const PAGE_SIZE = 1000;
const threshold = 0.025;

export interface IRawPoolProvider {
  getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<RawPool[]>;
}

// raw pools is only used in uniswapv2 subgraph
type RawSubgraphPool = {
  id: string;
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
  totalSupply: string;
  reserveETH: string;
  trackedReserveETH: string;
};

export class UniswapV2SubgraphPoolProvider implements IRawPoolProvider {
  private client: GraphQLClient;

  constructor(
    private chainId: ChainId,
    private retries = 2,
    private timeout = 360000,
    private rollback = true
  ) {
    const subgraphUrl = SUBGRAPH_URL_BY_CHAIN[chainId];
    if (!subgraphUrl) {
      throw new Error(`No subgraph url for chain id: ${this.chainId}`);
    }
    this.client = new GraphQLClient(subgraphUrl);
  }

  public async getPools(
    _tokenIn?: Token,
    _tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<RawPool[]> {
    let blockNumber = providerConfig?.blockNumber
      ? providerConfig.blockNumber
      : undefined;
    const query2 = gql`
    query getPools($pageSize: Int!, $id: String){
    pairs(first: $pageSize
    ${blockNumber ? `block: {number: ${blockNumber} }` : ''}
    where: {id_gt: $id}
    ){
    id
    token0 {id,  symbol}
    token1 {id, symbol}
    totalSupply
    reserveETH
    trackedReserveETH
    }
  }
  `;
    let pools: RawSubgraphPool[] = [];
    await retry(
      async () => {
        const timeout = new Timeout();
        // get all pools using page mode
        const getPools = async (): Promise<RawSubgraphPool[]> => {
          let lastId = '';
          let pairs: RawSubgraphPool[] = [];
          let pairsPage: RawSubgraphPool[] = [];
          do {
            await retry(
              async () => {
                const poolsResult = await this.client.request<{
                  pairs: RawSubgraphPool[];
                }>(query2, { pageSize: PAGE_SIZE, id: lastId });
                pairsPage = poolsResult.pairs;
                pairs = pairs.concat(pairsPage);
                lastId = pairs[pairs.length - 1]!.id;
              },
              {
                retries: this.retries,
                onRetry: (err, retry) => {
                  // reset pools
                  pools = [];
                  console.log(
                    { err },
                    `Failed request for page of pools from subgraph. Retry attempt: ${retry}`
                  );
                },
              }
            );
          } while (pairsPage.length > 0);

          return pairs;
        };

        try {
          const getPoolsPromise = getPools();
          const timerPromise = timeout.set(this.timeout).then(() => {
            throw new Error(
              `Timed out getting pools from subgraph: ${this.timeout}`
            );
          });
          pools = await Promise.race([getPoolsPromise, timerPromise]);
        } finally {
          timeout.clear();
        }
      },
      {
        retries: this.retries,
        onRetry: (err, retry) => {
          // retrive pools from rollbacked blocks
          if (
            this.rollback &&
            blockNumber &&
            _.includes(err.message, 'indexed up to')
          ) {
            (blockNumber as number) -= 10;
            console.log(
              `Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`
            );
          }
          pools = [];
          console.log(
            { err },
            `Failed to get pools from subgraph. Retry attempt: ${retry}`
          );
        },
      }
    );

    // postprocess
    const poolsSanitized: RawPool[] = filterPools(pools, 'Uniswap_V2');

    return poolsSanitized;
  }
}

export class UniswapV2StaticFileSubgraphProvider implements IRawPoolProvider {
  public async getPools(): Promise<RawPool[]> {
    const poolsSanitized = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../data/v2pools.json'), 'utf8')
    ) as RawSubgraphPool[];
    return filterPools(poolsSanitized, 'Uniswap_V2');
  }
}

const filterPools = (pools: RawSubgraphPool[], protocol: string): RawPool[] => {
  return pools
    .filter(pool => parseFloat(pool.trackedReserveETH) > threshold)
    .map(pool => ({
      id: pool.id.toLowerCase(),
      tokens: [
        { address: pool.token0.id.toLowerCase(), symbol: pool.token0.symbol },
        { address: pool.token1.id.toLowerCase(), symbol: pool.token1.symbol },
      ],
      reserve: parseFloat(pool.trackedReserveETH),
      protocol,
    }));
};

export class CurvePoolProvider implements IRawPoolProvider {
  public async getPools(): Promise<RawPool[]> {
    const curveInfos = Object.values(MAINNET_CURVE_INFOS);
    return _.map(curveInfos, (curveInfo: CurveInfo) => {
      const tokens: RawToken[] = _.map(curveInfo.tokens, (token: Token) => {
        return { address: token.address, symbol: token.symbol! };
      });
      const rawPool: RawPool = {
        protocol: 'Curve',
        id: curveInfo.poolAddress,
        tokens: tokens,
        reserve: Number.MAX_SAFE_INTEGER,
      };
      return rawPool;
    });
  }
}

interface BalancerPoolResponse {
  id: string;
  swapFee: string;
  tokens: Array<{
    address: string;
    decimals: number;
    balance: string;
    weight: string;
    symbol: string;
  }>;
  tokensList: string[];
  totalWeight: string;
  totalShares: string;
  amp: string | null;
}

export class BalancerV2PoolProvider implements IRawPoolProvider {
  private client: GraphQLClient;

  constructor(
    chainId: ChainId,
    private readonly _topPoolsFetched: number = 250
  ) {
    const subgraphUrl: string = BALANCER_V2_SUBGRAPH_URL_BY_CHAIN[chainId]!;
    this.client = new GraphQLClient(subgraphUrl);
  }

  public async getPools(): Promise<RawPool[]> {
    const pools = await this._fetchTopPoolsAsync();
    const rawPools: RawPool[] = _.map(pools, pool => {
      const tokens: RawToken[] = _.map(pool.tokens, token => {
        return { address: token.address, symbol: token.symbol };
      });
      return {
        id: pool.id,
        protocol: 'BalancerV2',
        tokens: tokens,
        reserve: Number.MAX_SAFE_INTEGER,
      };
    });
    return rawPools;
  }

  protected async _fetchTopPoolsAsync(): Promise<BalancerPoolResponse[]> {
    const query = gql`
      query fetchTopPools($topPoolsFetched: Int!) {
        pools(
          first: $topPoolsFetched
          where: { totalLiquidity_gt: 0 }
          orderBy: swapsCount
          orderDirection: desc
        ) {
          id
          swapFee
          totalWeight
          tokensList
          amp
          totalShares
          tokens {
            id
            address
            balance
            decimals
            symbol
            weight
          }
        }
      }
    `;
    const { pools } = await this.client.request<{
      pools: BalancerPoolResponse[];
    }>(query, { topPoolsFetched: this._topPoolsFetched });
    return pools;
  }
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
  protected balancerV2PoolProvider: IRawPoolProvider;
  private nodecache: NodeCache;
  constructor(public readonly chainId: ChainId) {
    this.uniswapV2SubgraphPoolProvider =
      new UniswapV2StaticFileSubgraphProvider();
    this.balancerV2PoolProvider = new BalancerV2PoolProvider(chainId);
    this.curvePoolProvider = new CurvePoolProvider();
    this.uniswapV3SubgraphPoolProvider = new UniswapV2SubgraphPoolProvider(
      chainId
    );
    this.nodecache = new NodeCache({ stdTTL: 3600, useClones: false });
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
        default:
          throw new Error(
            `unsupported protocol: ${protocol} when get rawPools!`
          );
      }
    }

    const poolsFetch = await Promise.all(poolsFetchPromises);
    const allRawPools: RawPool[] = _.flatMap(poolsFetch);
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
      for (const token of tokens) {
        if (!token) {
          logger.info(`Dropping candidate pool for ${rawPool.id}`);
          break;
        }
      }
      const tokensAmount = tokens.map(token => new TokenAmount(token!, 10));
      const pool = new Pool(
        tokensAmount,
        rawPool.id,
        PROTOCOLSTRMAP[rawPool.protocol]
      );
      poolAddressToPool[rawPool.id] = pool;
      const tokenPairs: TokenPair[] = _.flatMap(tokens, (tokenA): TokenPair[] =>
        tokens.map(tokenB => [tokenA!, tokenB!])
      ).filter(([tokenA, tokenB]) => !tokenA.equals(tokenB));

      _.forEach(tokenPairs, (tokens: TokenPair) => {
        const key = RawPoolProvider.calcCacheKey(tokens[0], tokens[1]);
        if (!tokensTopool[key]) {
          tokensTopool[key] = [];
        }
        tokensTopool[key].push(pool.id);
      });
    }
    // cache
    _.map(tokensTopool, (pools, key) => {
      this.nodecache.set(key, pools);
    });

    return {
      getPool: (tokenA: Token, tokenB: Token): Pool[] => {
        const key = RawPoolProvider.calcCacheKey(tokenA, tokenB);
        const poolAddresses = tokensTopool[key];
        return _.map(poolAddresses, addr => poolAddressToPool[addr]);
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
    return `${token0.chainId}/${token0}/${token1}`;
  }

  public getPoolAddress(tokenA: Token, tokenB: Token): string[] {
    const cacheKey = RawPoolProvider.calcCacheKey(tokenA, tokenB);
    const cachedAddress = this.nodecache.get<string[]>(cacheKey);
    if (!cachedAddress) {
      throw new Error(`cannot find pool address for ${tokenA}/${tokenB}`);
    }

    return cachedAddress;
  }
}
