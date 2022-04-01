import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';

import { BALANCER_V2_SUBGRAPH_URL_BY_CHAIN } from '../addresses';
import { IRawPoolProvider } from '../rawpool_provider';
import { ChainId, RawPool, RawToken } from '../types';

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
  totalLiquidity: string;
  totalShares: string;
  amp: string | null;
}

export class BalancerV2PoolProvider implements IRawPoolProvider {
  private client: GraphQLClient;

  constructor(
    chainId: ChainId,
    private readonly _topPoolsFetched: number = 250
  ) {
    const subgraphUrl: string = BALANCER_V2_SUBGRAPH_URL_BY_CHAIN[chainId];
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
        reserve: parseFloat(pool.totalLiquidity),
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
          totalLiquidity
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
