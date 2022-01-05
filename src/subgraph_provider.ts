import fs from 'fs';
import path from 'path';

import retry from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';


import { Token } from './entities';
import { ChainId, ProviderConfig, SubgraphPool } from './types';

const SUBGRAPH_URL_BY_CHAIN: { [chainId in ChainId]?: string } = {
  [ChainId.MAINNET]:
    'https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2',
  [ChainId.RINKEBY]:
    'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v2-rinkeby',
};
const PAGE_SIZE = 1000;
const threshold = 0.025;

export interface ISubgraphPoolProvider {
  getPools(
    tokenIn?: Token,
    tokenOut?: Token,
    providerConfig?: ProviderConfig
  ): Promise<SubgraphPool[]>;
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

export class SubgraphPoolProvider implements ISubgraphPoolProvider {
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
  ): Promise<SubgraphPool[]> {
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
    const poolsSanitized: SubgraphPool[] = filterPools(pools, 'Uniswap_V2');

    return poolsSanitized;
  }
}

export class StaticFileSubgraphProvider implements ISubgraphPoolProvider {
  public async getPools(): Promise<SubgraphPool[]> {
    const poolsSanitized = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../data/v2pools.json'), 'utf8')
    ) as RawSubgraphPool[];
    return filterPools(poolsSanitized, 'Uniswap_V2');
  }
}

const filterPools = (
  pools: RawSubgraphPool[],
  protocol: string
): SubgraphPool[] => {
  return pools
    .filter(pool => parseFloat(pool.trackedReserveETH) > threshold)
    .map(pool => ({
      ...pool,
      id: pool.id.toLowerCase(),
      token0: { id: pool.token0.id.toLowerCase(), symbol: pool.token0.symbol },
      token1: { id: pool.token1.id.toLowerCase(), symbol: pool.token1.symbol },
      supply: parseFloat(pool.totalSupply),
      reserve: parseFloat(pool.trackedReserveETH),
      protocol,
    }));
};
