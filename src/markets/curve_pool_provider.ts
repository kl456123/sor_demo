import retry from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';

import { Token } from '../entities';
import { IRawPoolProvider } from '../rawpool_provider';
import { ChainId, ProviderConfig, RawPool, RawToken } from '../types';

import { CurveInfo, MAINNET_CURVE_INFOS } from './curve';

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
        reserve: 1818768655.005331,
      };
      return rawPool;
    });
  }
}

const PAGE_SIZE = 1000;

const SUBGRAPH_URL_BY_CHAIN: { [chainId in ChainId]?: string } = {
  [ChainId.MAINNET]:
    'https://api.thegraph.com/subgraphs/name/blocklytics/curve',
};

type TokenBalance = {
  token: {
    id: string;
    symbol: string;
  };
  underlyingToken: {
    id: string;
    symbol: string;
  };
};

// raw pools is only used in curve subgraph
type RawSubgraphPool = {
  id: string;
  tokenBalances: TokenBalance[];
  totalUnderlyingVolumeDecimal: string;
};

export class CurveSubgraphPoolProvider implements IRawPoolProvider {
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
    query getExchanges($pageSize: Int!, $id: String){
    exchanges(first: $pageSize
    ${blockNumber ? `block: {number: ${blockNumber} }` : ''}
    where: {id_gt: $id}
    ){
    id
    tokenBalances{
      token {
        id
        symbol
      }
      underlyingToken {
        id
        symbol
      }
    }
    totalUnderlyingVolumeDecimal
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
                  exchanges: RawSubgraphPool[];
                }>(query2, { pageSize: PAGE_SIZE, id: lastId });
                pairsPage = poolsResult.exchanges;
                pairs = pairs.concat(pairsPage);
                lastId = pairs[pairs.length - 1].id;
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
    const poolsSanitized: RawPool[] = filterPools(pools, 'Curve');

    return poolsSanitized;
  }
}

const filterPools = (pools: RawSubgraphPool[], protocol: string): RawPool[] => {
  return pools
    .filter(pool => parseFloat(pool.totalUnderlyingVolumeDecimal) > 0)
    .map(pool => ({
      id: pool.id.toLowerCase(),
      tokens: pool.tokenBalances.map(tokenBalance => {
        return {
          address: tokenBalance.underlyingToken.id,
          symbol: tokenBalance.underlyingToken.symbol,
        };
      }),
      reserve: parseFloat(pool.totalUnderlyingVolumeDecimal),
      protocol,
    }));
};
