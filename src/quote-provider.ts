import { orderCalculationUtils } from '@0x/order-utils';
import { pack } from '@ethersproject/solidity';
import { FeeAmount } from '@uniswap/v3-sdk';
import { BigNumber } from 'bignumber.js';
import { BigNumber as EtherBigNumber, providers } from 'ethers';
import _ from 'lodash';

import { ProtocolForFeeAmount } from './constants';
import { Pool, Route, Token, TokenAmount } from './entities';
import { Orderbook, sortOrders } from './markets/orderbook';
import { IMulticallProvider, MulticallProvider } from './multicall-provider';
import { DexSample, Sampler } from './sampler';
import {
  ChainId,
  Protocol,
  RoutesByProtocol,
  RouteWithQuotes,
  TradeType,
} from './types';
import { QuoterV2__factory } from './types/v3';

const ORDERBOOK_URL = 'https://api.0x.org/sra';
const QUOTERV2_ADDRESS = '0x0209c4Dc18B2A1439fD2427E34E7cF3c6B91cFB9';

// get sample quotes from quote contracts on-chain
export class QuoteProvider {
  private sampler: Sampler;
  private orderbook: Orderbook;
  private multicall2Provider: IMulticallProvider;
  constructor(chainId: ChainId, provider: providers.BaseProvider) {
    this.sampler = new Sampler(chainId, provider, {});
    this.orderbook = new Orderbook(ORDERBOOK_URL);
    this.multicall2Provider = new MulticallProvider(chainId, provider);
  }
  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routesByProtocol: RoutesByProtocol
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountIns, routesByProtocol, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountOuts: TokenAmount[],
    routesByProtocol: RoutesByProtocol
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(amountOuts, routesByProtocol, TradeType.EXACT_OUTPUT);
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routesByProtocol: RoutesByProtocol,
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    const routesWithQuotes: RouteWithQuotes[] = [];

    // handle limit orders first
    if (Protocol.ZeroX in routesByProtocol) {
      const routesByLimitOrder = routesByProtocol[Protocol.ZeroX];
      const routesWithQuotesByLimitOrder = await Promise.all(
        _.map(routesByLimitOrder, route => {
          return this.getQuoteForLimitOrder(amounts, route, tradeType);
        })
      );
      routesWithQuotes.push(...routesWithQuotesByLimitOrder);
    }

    // handle uniswapv3 here
    const uniswapV3Protocols = [
      Protocol.UniswapV3_LOW,
      Protocol.UniswapV3_HIGH,
      Protocol.UniswapV3_LOWEST,
      Protocol.UniswapV3_MEDIUM,
    ];
    if (uniswapV3Protocols.some(p => p in routesByProtocol)) {
      const uniswapV3Routes = _.flatMap(
        uniswapV3Protocols,
        uniswapV3Protocol => {
          return routesByProtocol[uniswapV3Protocol] ?? [];
        }
      );
      const routesWithQuotesByUniswapV3 = await this.getQuotesForUniswapV3(
        amounts,
        uniswapV3Routes,
        tradeType
      );
      routesWithQuotes.push(...routesWithQuotesByUniswapV3);
    }

    // handle common case
    const remainingRoutes: Route[] = _.flatMap(
      routesByProtocol,
      (routes, protocol) => {
        if (
          [
            'Uniswap_V3_LOW',
            'Uniswap_V3_HIGH',
            'Uniswap_V3_LOWEST',
            'Uniswap_V3_MEDIUM',
            'ZeroX',
          ].includes(protocol)
        ) {
          return [];
        }
        return routes!;
      }
    );
    const fillAmounts = amounts.map(amt => amt.amount);
    const samplerRoutes = remainingRoutes.map(route => {
      return {
        protocol: route.protocol,
        path: route.path.map(p => p.address),
        poolAddress: route.poolAddress,
      };
    });
    let dexQuotes: DexSample[][];
    if (tradeType === TradeType.EXACT_INPUT) {
      [dexQuotes] = await this.sampler.executeAsync(
        this.sampler.getSellQuotes(fillAmounts, samplerRoutes)
      );
    } else {
      [dexQuotes] = await this.sampler.executeAsync(
        this.sampler.getBuyQuotes(fillAmounts, samplerRoutes)
      );
    }

    const routesWithQuotesByProtocol: RouteWithQuotes[] = dexQuotes.map(
      (dexQuote, i) => {
        const amountQuote = dexQuote.map((quote, j) => {
          return { amount: amounts[j], quote: quote.output };
        });
        return [remainingRoutes[i], amountQuote];
      }
    );

    routesWithQuotes.push(...routesWithQuotesByProtocol);
    return routesWithQuotes;
  }

  private async getQuoteForLimitOrder(
    tokenAmounts: TokenAmount[],
    routeByLimitOrder: Route,
    tradeType: TradeType
  ): Promise<RouteWithQuotes> {
    const baseToken = routeByLimitOrder.path[0];
    const quoteToken = routeByLimitOrder.path[1];
    const takerTokenAddress =
      tradeType == TradeType.EXACT_INPUT
        ? baseToken.address
        : quoteToken.address;
    const makerTokenAddress =
      tradeType == TradeType.EXACT_INPUT
        ? quoteToken.address
        : baseToken.address;
    const orders = await this.orderbook.getOrdersAsync(
      makerTokenAddress,
      takerTokenAddress
    );

    // get fillable amouts from on-chain data
    const quoteFn =
      tradeType == TradeType.EXACT_INPUT
        ? this.sampler.getOrderFillableTakerAssetAmounts.bind(this.sampler)
        : this.sampler.getOrderFillableMakerAssetAmounts.bind(this.sampler);
    const [orderFillableAmounts] = await this.sampler.executeAsync(
      quoteFn(orders)
    );

    const orderwithfillableAmounts = _.map(orders, (order, i) => {
      // use BigNumber from bignumber.js for 0x orderbook
      const orderFillableAmount = new BigNumber(
        orderFillableAmounts[i].toString()
      );
      const fillableTakerAssetAmount =
        tradeType == TradeType.EXACT_INPUT
          ? orderFillableAmount
          : orderCalculationUtils.getTakerFillAmount(
              order,
              orderFillableAmount
            );
      const fillableMakerAssetAmount =
        tradeType == TradeType.EXACT_OUTPUT
          ? orderFillableAmount
          : orderCalculationUtils.getMakerFillAmount(
              order,
              orderFillableAmount
            );
      // fee for taker only
      const fillableTakerFeeAmount = orderCalculationUtils.getTakerFeeAmount(
        order,
        fillableTakerAssetAmount
      );

      return {
        ...order,
        fillableMakerAssetAmount,
        fillableTakerAssetAmount,
        fillableTakerFeeAmount,
      };
    });

    const descendingForBuy = tradeType !== TradeType.EXACT_INPUT;
    const sortedOrders = sortOrders(orderwithfillableAmounts, descendingForBuy);

    // including taker fee
    const fillableTakerAmounts = _.map(sortedOrders, o => {
      return o.fillableTakerAssetAmount.plus(o.fillableTakerFeeAmount);
    });
    // no including maker fee
    const fillableMakerAmounts = _.map(sortedOrders, o => {
      return o.fillableMakerAssetAmount;
    });
    const input: BigNumber[] =
      tradeType == TradeType.EXACT_INPUT
        ? fillableTakerAmounts
        : fillableMakerAmounts;
    const output: BigNumber[] =
      tradeType == TradeType.EXACT_INPUT
        ? fillableMakerAmounts
        : fillableTakerAmounts;

    // including 0
    const inputCumsum: BigNumber[] = _.reduce(
      input,
      (acc: BigNumber[], cur) => {
        acc.push(cur.plus(acc[acc.length - 1]));
        return acc;
      },
      [new BigNumber(0)]
    );

    const outputCumsum: BigNumber[] = _.reduce(
      output,
      (acc: BigNumber[], cur) => {
        acc.push(cur.plus(acc[acc.length - 1]));
        return acc;
      },
      [new BigNumber(0)]
    );

    const amounts = _.map(
      tokenAmounts,
      tokenAmount => new BigNumber(tokenAmount.amount.toString())
    );
    const amountsQuote = _.map(amounts, (amount, i) => {
      let j;
      let quote = new BigNumber(outputCumsum[outputCumsum.length - 1]);
      for (j = 0; j < inputCumsum.length; ++j) {
        if (inputCumsum[j].gt(amount)) {
          const remainingTakerAmount = amount.minus(inputCumsum[j - 1]);
          const remainingMakerAmount = orderCalculationUtils.getMakerFillAmount(
            sortedOrders[j],
            remainingTakerAmount
          );
          quote = outputCumsum[j - 1].plus(remainingMakerAmount);
          break;
        }
      }
      return {
        amount: tokenAmounts[i],
        quote: EtherBigNumber.from(quote.toString()),
      };
    });
    return [routeByLimitOrder, amountsQuote];
  }

  private async getQuotesForUniswapV3(
    tokenAmounts: TokenAmount[],
    routes: Route[],
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    const functionName =
      tradeType == TradeType.EXACT_INPUT
        ? 'quoteExactInput'
        : 'quoteExactOutput';
    const exactOutput = tradeType == TradeType.EXACT_OUTPUT;
    const inputs: [string, string][] = _(routes)
      .flatMap(route => {
        const fee = ProtocolForFeeAmount[route.protocol]!;
        const encodedRoute = encodeRouteToPath(route, exactOutput, fee);
        const routeInputs: [string, string][] = tokenAmounts.map(
          tokenAmount => [encodedRoute, `${tokenAmount.amount.toHexString()}`]
        );
        return routeInputs;
      })
      .value();

    // multicall for all inputs
    const addresses = new Array(inputs.length).fill(QUOTERV2_ADDRESS);

    const { results: quoteResults } = await this.multicall2Provider.call({
      functionName,
      addresses,
      contractInterface: QuoterV2__factory.createInterface(),
      functionParams: inputs,
    });
    const routesQuotes: RouteWithQuotes[] = [];
    const quoteResultsByRoute = _.chunk(quoteResults, tokenAmounts.length);
    for (let i = 0; i < quoteResultsByRoute.length; ++i) {
      const quoteResults = quoteResultsByRoute[i];
      const route = routes[i];
      const quotes = _.map(quoteResults, (quoteResult, index: number) => {
        const tokenAmount = tokenAmounts[index];
        return {
          amount: tokenAmount,
          quote: quoteResult.result[0], // array
        };
      });
      routesQuotes.push([route, quotes]);
    }
    return routesQuotes;
  }
}

function encodeRouteToPath(
  route: Route,
  exactOutput: boolean,
  fee: FeeAmount
): string {
  const firstInputToken = route.input;
  const { path, types } = route.pools.reduce(
    (
      {
        inputToken,
        path,
        types,
      }: { inputToken: Token; path: (string | number)[]; types: string[] },
      pool: Pool,
      index
    ) => {
      const outputToken = pool.token0.equals(inputToken)
        ? pool.token1
        : pool.token0;
      if (index === 0) {
        return {
          inputToken: outputToken,
          types: ['address', 'uint24', 'address'],
          path: [inputToken.address, fee, outputToken.address],
        };
      } else {
        return {
          inputToken: outputToken,
          types: [...types, 'uint24', 'address'],
          path: [...path, fee, outputToken.address],
        };
      }
    },
    { inputToken: firstInputToken, path: [], types: [] }
  );
  return exactOutput
    ? pack(types.reverse(), path.reverse())
    : pack(types, path);
}
