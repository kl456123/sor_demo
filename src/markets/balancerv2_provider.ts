import { BigNumber } from 'bignumber.js';
import { gql, GraphQLClient } from 'graphql-request';

import { BALANCER_V2_SUBGRAPH_URL_BY_CHAIN } from '../addresses';
import { ChainId } from '../types';

type BalancerV2Pool = {
  id: string;
  balanceIn: BigNumber;
  balanceOut: BigNumber;
  weightIn: BigNumber;
  weightOut: BigNumber;
  swapFee: BigNumber;
};

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class BalancerV2PoolsCache {
  private static _parseSubgraphPoolData(
    pool: any,
    takerToken: string,
    makerToken: string
  ): BalancerV2Pool {
    const tToken = pool.tokens.find((t: any) => t.address === takerToken);
    const mToken = pool.tokens.find((t: any) => t.address === makerToken);
    return {
      id: pool.id,
      balanceIn: new BigNumber(tToken.balance),
      balanceOut: new BigNumber(mToken.balance),
      weightIn: new BigNumber(tToken.weight),
      weightOut: new BigNumber(mToken.weight),
      swapFee: new BigNumber(pool.swapFee),
    };
  }

  private cache: { [id: string]: BalancerV2Pool[] };
  private client: GraphQLClient;

  constructor(
    chainId: ChainId,
    private readonly _topPoolsFetched: number = 250,
    cache: { [key: string]: BalancerV2Pool[] } = {}
  ) {
    const subgraphUrl: string = BALANCER_V2_SUBGRAPH_URL_BY_CHAIN[chainId]!;
    this.client = new GraphQLClient(subgraphUrl);
    this.cache = cache;
    setInterval(async () => void this.loadTopPoolsAsync(), ONE_DAY_MS / 2);
  }

  protected async _fetchTopPoolsAsync() {
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

  public async loadTopPoolsAsync(): Promise<void> {
    const pools = await this._fetchTopPoolsAsync();
    const fromToPools: { [from: string]: { [to: string]: BalancerV2Pool[] } } =
      {};
    for (const pool of pools) {
      const { tokensList } = pool;
      for (const from of tokensList) {
        for (const to of tokensList.filter(
          t => t.toLowerCase() !== from.toLowerCase()
        )) {
          fromToPools[from] = fromToPools[from] || {};
          fromToPools[from][to] = fromToPools[from][to] || [];
          fromToPools[from][to].push(
            BalancerV2PoolsCache._parseSubgraphPoolData(pool, from, to)
          );
          const key = JSON.stringify([from.toLowerCase(), to.toLowerCase()]);
          // upate cache
          this.cache[key] = fromToPools[from][to];
        }
      }
    }
  }

  public getCachedPoolAddressForPair(
    takerToken: string,
    makerToken: string
  ): string[] | undefined {
    const key = JSON.stringify([takerToken, makerToken]);
    const pools = this.cache[key];
    if (!pools) {
      return undefined;
    }
    return pools.map(pool => pool.id);
  }

  public async getFreshPoolsForPairAsync(): Promise<BalancerV2Pool[]> {
    // TODO return fresh pools data and update cache
    return [];
  }
}
