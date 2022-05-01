import _ from 'lodash';
import invariant from 'tiny-invariant';

import { Token, TokenAmount } from './entities';
import { Protocol, TradeType } from './types';

export class PoolV2 {
  public readonly tokensAmount: TokenAmount[];
  public readonly tokens: Token[];
  public readonly protocol: Protocol;
  public readonly id: string;
  public readonly poolData?: unknown;
  constructor(
    tokensAmount: TokenAmount[],
    id: string,
    protocol: Protocol = Protocol.Unknow,
    poolData?: unknown
  ) {
    this.tokens = tokensAmount.map(tokenAmount => tokenAmount.token);
    this.tokensAmount = tokensAmount;
    this.protocol = protocol;
    this.id = id.toLowerCase();
    this.poolData = poolData;
  }

  public involvesToken(token: Token): boolean {
    return this.tokensAmount.some(tokenAmount =>
      tokenAmount.token.equals(token)
    );
  }
  public get token0(): Token {
    return this.tokensAmount[0].token;
  }

  public get chainId(): number {
    return this.token0.chainId;
  }
}

// route path from input token to output token
export class RouteV2 {
  public readonly input: Token;
  public readonly output: Token;
  public readonly pools: PoolV2[];
  public readonly path: Token[];
  constructor(pools: PoolV2[], path: Token[]) {
    invariant(path.length > 1, 'PATH');
    invariant(pools.length > 0, 'POOL');
    const input = path[0];
    const output = path[path.length - 1];
    invariant(pools[0].involvesToken(input), 'INPUT');
    invariant(pools[pools.length - 1].involvesToken(output), 'OUTPUT');
    invariant(pools.length === path.length - 1, 'LENGTH');

    this.path = path;
    this.pools = pools;
    this.input = input;
    this.output = output;
  }

  public get chainId(): number {
    return this.pools[0].chainId;
  }

  public get routeKey(): string {
    const pathStr: string[] = [];
    // use address to identify a token
    this.path.forEach(token => pathStr.push(token.address));
    return pathStr.join('/');
  }
}

export enum RouteType {
  MULTI_HOP,
  BATCH,
  DIRECTSWAP,
}

export type MultiplexRoute = MultiHopRoute | BatchRoute | DirectSwapRoute;

export class MultiHopRoute {
  public readonly routeType = RouteType.MULTI_HOP;
  public readonly input: Token;
  public readonly output: Token;
  public readonly routes: MultiplexRoute[];
  public readonly path: Token[];
  public readonly poolIds: string[];
  constructor(routes: MultiplexRoute[], path: Token[]) {
    const input = path[0];
    const output = path[path.length - 1];
    invariant(routes.length === path.length - 1, 'LENGTH');
    this.path = path;
    this.routes = routes;
    this.input = input;
    this.output = output;
    this.poolIds = _(routes)
      .flatMap(route => route.poolIds)
      .uniq()
      .value();
  }
}

export class BatchRoute {
  public readonly input: Token;
  public readonly routes: MultiplexRoute[];
  public readonly outputs: Token[];
  public readonly routeType = RouteType.BATCH;
  public readonly poolIds: string[];
  constructor(routes: MultiplexRoute[], input: Token, outputs: Token[]) {
    invariant(routes.length > 0, 'POOL');
    invariant(routes.length === outputs.length, 'LENGTH');

    this.routes = routes;
    this.input = input;
    this.outputs = outputs;
    this.poolIds = _(routes)
      .flatMap(route => route.poolIds)
      .uniq()
      .value();
  }
}

export class DirectSwapRoute {
  public readonly input: Token;
  public readonly pool: PoolV2;
  public readonly output: Token;
  public readonly routeType = RouteType.DIRECTSWAP;
  public readonly poolIds: string[];
  constructor(pool: PoolV2, input: Token, output: Token) {
    invariant(pool.involvesToken(input), 'INPUT');
    invariant(pool.involvesToken(output), 'OUTPUT');
    this.pool = pool;
    this.input = input;
    this.output = output;
    this.poolIds = [pool.id];
  }
}

export interface IMultiplexRouteWithValidQuote {
  amount: TokenAmount;
  percent: number;
  quoteAdjustedForGas: TokenAmount;
  quote: TokenAmount;
  route: MultiplexRoute;
  tradeType: TradeType;
  poolAddresses: string[];
  tokenPath: Token[];
}

export type MultiplexRouteWithValidQuoteParams = {
  amount: TokenAmount;
  percent: number;
  quote: TokenAmount;
  quoteAdjustedForGas: TokenAmount;
  routesWithQuote: MultiplexRouteWithValidQuote[];
  route?: MultiplexRoute;
  routeType: RouteType;
};

export class MultiplexRouteWithValidQuote {
  public amount: TokenAmount;
  public percent: number;
  public quoteAdjustedForGas: TokenAmount;
  public quote: TokenAmount;
  public routesWithQuote: MultiplexRouteWithValidQuote[];
  public readonly route?: MultiplexRoute;
  public routeType: RouteType;
  public poolIds: string[];
  constructor({
    amount,
    percent,
    quote,
    route,
    quoteAdjustedForGas,
    routesWithQuote,
    routeType,
  }: MultiplexRouteWithValidQuoteParams) {
    this.amount = amount;
    this.percent = percent;
    this.quote = quote;
    this.routesWithQuote = routesWithQuote;
    this.routeType = routeType;
    this.quoteAdjustedForGas = quoteAdjustedForGas;
    if (this.routeType === RouteType.DIRECTSWAP) {
      invariant(route, 'DIRECTSWAP ROUTE');
      this.route = route;
      this.poolIds = route.poolIds;
    } else {
      this.poolIds = _(this.routesWithQuote)
        .flatMap(routeWithQuote => routeWithQuote.poolIds)
        .uniq()
        .value();
    }
  }
}
