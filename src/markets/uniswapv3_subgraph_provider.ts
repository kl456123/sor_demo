import { default as retry } from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';

import { Token } from '../entities';
import { logger } from '../logging';
import { IRawPoolProvider } from '../rawpool_provider';
import { ChainId, ProviderConfig, RawPool } from '../types';

const SUBGRAPH_URL_BY_CHAIN: { [chainId in ChainId]?: string } = {
  [ChainId.MAINNET]:
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  [ChainId.RINKEBY]:
    'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-rinkeby',
};

const PAGE_SIZE = 1000; // 1k is max possible query size from subgraph.
export interface UniswapV3PoolData {
  feeTier: number;
}

type RawV3SubgraphPool = {
  id: string;
  feeTier: string;
  liquidity: string;
  token0: {
    symbol: string;
    id: string;
  };
  token1: {
    symbol: string;
    id: string;
  };
  totalValueLockedUSD: string;
  totalValueLockedETH: string;
};

export class UniswapV3SubgraphPoolProvider implements IRawPoolProvider {
  private client: GraphQLClient;
  constructor(
    private chainId: ChainId,
    private retries = 2,
    private timeout = 30000,
    private rollback = true
  ) {
    const subgraphUrl = SUBGRAPH_URL_BY_CHAIN[this.chainId];
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
      ? await providerConfig.blockNumber
      : undefined;
    const query = gql`
      query getPools($pageSize: Int!, $id: String) {
        pools(
          first: $pageSize
          ${blockNumber ? `block: { number: ${blockNumber} }` : ``}
          where: { id_gt: $id, liquidity_gt:0 }
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          feeTier
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
        }
      }
    `;

    let pools: RawV3SubgraphPool[] = [];

    logger.info(
      `Getting pools from the subgraph with page size ${PAGE_SIZE}${
        providerConfig?.blockNumber
          ? ` as of block ${providerConfig?.blockNumber}`
          : ''
      }.`
    );
    await retry(
      async () => {
        const timeout = new Timeout();

        const getPools = async (): Promise<RawV3SubgraphPool[]> => {
          let lastId = '';
          let pools: RawV3SubgraphPool[] = [];
          let poolsPage: RawV3SubgraphPool[] = [];

          do {
            const poolsResult = await this.client.request<{
              pools: RawV3SubgraphPool[];
            }>(query, {
              pageSize: PAGE_SIZE,
              id: lastId,
            });

            poolsPage = poolsResult.pools;

            pools = pools.concat(poolsPage);

            lastId = pools[pools.length - 1]!.id;
          } while (poolsPage.length > 0);

          return pools;
        };

        try {
          const getPoolsPromise = getPools();
          const timerPromise = timeout.set(this.timeout).then(() => {
            throw new Error(
              `Timed out getting pools from subgraph: ${this.timeout}`
            );
          });
          pools = await Promise.race([getPoolsPromise, timerPromise]);
          return;
        } finally {
          timeout.clear();
        }
      },
      {
        retries: this.retries,
        onRetry: (err, retry) => {
          if (
            this.rollback &&
            blockNumber &&
            _.includes(err.message, 'indexed up to')
          ) {
            blockNumber = blockNumber - 10;
            logger.info(
              `Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`
            );
          }
          pools = [];
          logger.info(
            { err },
            `Failed to get pools from subgraph. Retry attempt: ${retry}`
          );
        },
      }
    );

    const poolsSanitized = pools.map(pool => {
      const { totalValueLockedUSD } = pool;

      const tokens = [
        { address: pool.token0.id.toLowerCase(), symbol: pool.token0.symbol },
        { address: pool.token1.id.toLowerCase(), symbol: pool.token1.symbol },
      ];
      return {
        protocol: 'Uniswap_V3',
        id: pool.id.toLowerCase(),
        tokens,
        reserve: parseFloat(totalValueLockedUSD),
        poolData: { feeTier: pool.feeTier },
      };
    });

    logger.info(
      `Got ${pools.length} V3 pools from the subgraph. ${poolsSanitized.length} after filtering`
    );

    return poolsSanitized;
  }
}
