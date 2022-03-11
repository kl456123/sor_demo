import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';

import { BALANCER_SUBGRAPH_URL } from '../addresses';
import { IRawPoolProvider } from '../rawpool_provider';
import { RawPool, RawToken } from '../types';

interface BalancerPoolResponse {
  id: string;
  swapFee: string;
  tokens: Array<{
    address: string;
    decimals: number;
    balance: string;
    symbol: string;
  }>;
  tokensList: string[];
  totalWeight: string;
  liquidity: string;
}

export class BalancerPoolProvider implements IRawPoolProvider {
  private client: GraphQLClient;

  constructor(private readonly _topPoolsFetched: number = 250) {
    const subgraphUrl: string = BALANCER_SUBGRAPH_URL;
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
        protocol: 'Balancer',
        tokens: tokens,
        reserve: parseFloat(pool.liquidity),
      };
    });
    return rawPools;
  }

  protected async _fetchTopPoolsAsync(): Promise<BalancerPoolResponse[]> {
    const query = gql`
      query fetchTopPools($topPoolsFetched: Int!) {
        pools(
          first: $topPoolsFetched
          where: { publicSwap: true, liquidity_gt: 0, active: true }
          orderBy: swapsCount
          orderDirection: desc
        ) {
          id
          publicSwap
          swapFee
          totalWeight
          tokensList
          liquidity
          tokens {
            id
            address
            balance
            decimals
            symbol
            denormWeight
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
