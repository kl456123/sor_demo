// all base entities for trading
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BigNumber as Big } from 'bignumber.js';
import _ from 'lodash';
import invariant from 'tiny-invariant';

import { IPoolProvider } from './pool_provider';
import { Protocol, TradeType } from './types';

class Token {
  public readonly chainId: number;
  public readonly name?: string;
  public readonly decimals: number;
  public readonly address: string;
  public readonly symbol?: string;
  constructor({
    chainId,
    address,
    decimals,
    name,
    symbol,
  }: {
    chainId: number;
    address: string;
    decimals: number;
    name?: string;
    symbol?: string;
  }) {
    this.name = name;
    this.chainId = chainId;
    this.decimals = decimals;
    this.address = address;
    this.symbol = symbol;
  }

  public equals(other: Token): boolean {
    return this.address == other.address && this.chainId == other.chainId;
  }

  public sortsBefore(other: Token): boolean {
    invariant(this.chainId === other.chainId, 'DIFFERENT CHAIN_IDS');
    invariant(this.address !== other.address, 'SAME ADDRESSES');
    return this.address < other.address;
  }
}

class TokenAmount {
  public readonly token: Token;
  public readonly amount: BigNumber;
  public readonly decimalScale: BigNumber;
  constructor(token: Token, amount: BigNumber) {
    this.token = token;
    this.amount = amount;
    this.decimalScale = BigNumber.from(10).pow(this.token.decimals);
  }

  public multiply(other: BigNumberish): TokenAmount {
    return new TokenAmount(this.token, this.amount.mul(other));
  }

  public add(other: TokenAmount | BigNumber): TokenAmount {
    if (this.isBigNumberish(other)) {
      return new TokenAmount(this.token, this.amount.add(other));
    }
    invariant(this.token.equals(other.token), 'TOKEN');
    return new TokenAmount(this.token, this.amount.add(other.amount));
  }

  public divide(other: BigNumberish): TokenAmount {
    return new TokenAmount(this.token, this.amount.div(other));
  }

  public isBigNumberish(other: any): other is BigNumberish {
    return (
      other instanceof BigNumber ||
      typeof other === 'number' ||
      typeof other === 'string'
    );
  }

  public subtract(other: TokenAmount): TokenAmount {
    if (this.isBigNumberish(other)) {
      return new TokenAmount(this.token, this.amount.sub(other));
    }
    invariant(this.token.equals(other.token), 'TOKEN');
    return new TokenAmount(this.token, this.amount.sub(other.amount));
  }

  public greatThan(other: TokenAmount | BigNumberish): boolean {
    if (this.isBigNumberish(other)) {
      return this.amount.gt(other);
    }
    invariant(this.token.equals(other.token), 'TOKEN');
    return this.amount.gt(other.amount);
  }

  public lessThan(other: TokenAmount | BigNumberish): boolean {
    if (this.isBigNumberish(other)) {
      return this.amount.lt(other);
    }
    invariant(this.token.equals(other.token), 'TOKEN');
    return this.amount.lt(other.amount);
  }

  public toFixed(): string {
    return this.amount.div(this.decimalScale).toString();
  }
  public toExact(): string {
    return new Big(this.amount.toString())
      .div(this.decimalScale.toString())
      .toString();
  }
}

class Pool {
  public readonly tokens: [TokenAmount, TokenAmount];
  public readonly protocol: Protocol;
  constructor(tokens: [TokenAmount, TokenAmount], protocol: Protocol) {
    this.tokens = tokens;
    this.protocol = protocol;
  }

  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1);
  }

  public get token0(): Token {
    return this.tokens[0].token;
  }

  public get token1(): Token {
    return this.tokens[1].token;
  }

  public get chainId(): number {
    return this.token0.chainId;
  }
}

// route path from input token to output token
class Route {
  public readonly input: Token;
  public readonly output: Token;
  public readonly pools: Pool[];
  public readonly path: Token[];
  constructor(pools: Pool[], input: Token, output: Token) {
    // pools[0].involvesToken();
    const path: Token[] = [input];
    invariant(pools[0].involvesToken(input), 'INPUT');
    invariant(pools[pools.length - 1].involvesToken(output), 'OUTPUT');
    // get path from pools
    for (const [i, pool] of pools.entries()) {
      const currentInput = path[i];
      invariant(
        currentInput.equals(pool.token0) || currentInput.equals(pool.token1),
        'PATH'
      );
      const output = currentInput.equals(pool.token0)
        ? pool.token1
        : pool.token0;
      path.push(output);
    }
    this.path = path;
    this.pools = pools;
    this.input = input;
    this.output = output;
  }

  public get chainId(): number {
    return this.pools[0].chainId;
  }
  public get protocol(): Protocol {
    return this.pools[0].protocol;
  }
}

export interface IRouteWithValidQuote {
  amount: TokenAmount;
  percent: number;
  quoteAdjustedForGas: TokenAmount;
  quote: TokenAmount;
  route: Route;
  tradeType: TradeType;
  poolAddresses: string[];
  tokenPath: Token[];
}

export type RouteWithValidQuoteParams = {
  amount: TokenAmount;
  percent: number;
  rawQuote: BigNumber;
  quoteToken: Token;
  route: Route;
  tradeType: TradeType;
  poolProvider: IPoolProvider;
};

class RouteWithValidQuote implements IRouteWithValidQuote {
  public amount: TokenAmount;
  public percent: number;
  public quoteAdjustedForGas: TokenAmount;
  public quote: TokenAmount;
  public route: Route;
  public tradeType: TradeType;
  public poolAddresses: string[];
  public tokenPath: Token[];
  public gasCostInToken: TokenAmount;
  constructor({
    amount,
    percent,
    rawQuote,
    quoteToken,
    route,
    tradeType,
    poolProvider,
  }: RouteWithValidQuoteParams) {
    this.amount = amount;
    this.percent = percent;
    this.quote = new TokenAmount(quoteToken, rawQuote);
    this.route = route;
    this.tradeType = tradeType;
    this.tokenPath = route.path;

    // no gas cost considered
    this.gasCostInToken = new TokenAmount(quoteToken, BigNumber.from(0));

    if (tradeType == TradeType.EXACT_INPUT) {
      const quoteGasAdjusted = this.quote.subtract(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    } else {
      const quoteGasAdjusted = this.quote.add(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    }

    // get pools addresses
    this.poolAddresses = _.map(route.pools, pool => {
      return poolProvider.getPoolAddress(
        pool.token0,
        pool.token1,
        pool.protocol
      ).poolAddress;
    });
  }
}

export { Token, Pool, Route, TokenAmount, RouteWithValidQuote };
