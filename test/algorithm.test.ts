import { computeAllRoutes, getCandidatePools } from '../src/algorithm';
import { TOKENS } from '../src/base_token';
import { DEFAULT_ROUTER_CONFIG, PROTOCOLSTRMAP } from '../src/constants';
import { Pool, Token } from '../src/entities';
import { IPoolProvider, PoolProvider } from '../src/pool_provider';
import {
  ISubgraphPoolProvider,
  StaticFileSubgraphProvider,
} from '../src/subgraph_provider';
import { ITokenProvider, TokenProvider } from '../src/token_provider';
import { ChainId, TradeType } from '../src/types';

describe('test sor algorithm function', () => {
  let tokenIn: Token;
  let chainId: ChainId;
  let tokens;
  let tokenOut: Token;
  let tradeType: TradeType;
  let pools: Pool[];
  let subgraphPoolProvider: ISubgraphPoolProvider;
  let tokenProvider: ITokenProvider;
  let poolProvider: IPoolProvider;

  beforeAll(() => {
    chainId = ChainId.MAINNET;
    tradeType = TradeType.EXACT_INPUT;
    tokens = TOKENS[chainId]!;
    tokenIn = tokens.USDC;
    tokenOut = tokens.WETH;
    pools = [];

    // all providers to fetch data on-chain and off-chain
    subgraphPoolProvider = new StaticFileSubgraphProvider();
    tokenProvider = new TokenProvider(chainId);
    poolProvider = new PoolProvider(chainId);
  });

  describe('test to get all candidate pools', () => {
    test('succeed to get all pools', async () => {
      const routingConfig = DEFAULT_ROUTER_CONFIG;
      const { poolAccessor } = await getCandidatePools({
        chainId,
        tokenIn,
        tokenOut,
        tradeType,
        routingConfig,
        subgraphPoolProvider,
        tokenProvider,
        poolProvider,
      });
      const pools = poolAccessor.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      pools.map(pool => {
        expect(pool.tokens.length).toBeGreaterThan(0);
        expect(pool.protocol in PROTOCOLSTRMAP).toBeTruthy();
      });
    });
  });

  describe('test to compute all routes', () => {
    test('succeed to get all routes', async () => {
      const maxHops = 2;

      const routingConfig = DEFAULT_ROUTER_CONFIG;
      const { poolAccessor } = await getCandidatePools({
        chainId,
        tokenIn,
        tokenOut,
        tradeType,
        routingConfig,
        subgraphPoolProvider,
        tokenProvider,
        poolProvider,
      });
      pools = poolAccessor.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      const routes = computeAllRoutes(tokenIn, tokenOut, pools, maxHops);
      expect(routes.length).toBeGreaterThan(0);
    });
  });
});
