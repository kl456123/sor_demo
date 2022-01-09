// get sample quotes from quote contracts on-chain
//
//
import { orderCalculationUtils } from '@0x/order-utils';
import { BigNumber } from 'bignumber.js';
import { BigNumber as EtherBigNumber, providers } from 'ethers';
import _ from 'lodash';

import { Route, TokenAmount } from './entities';
import { Orderbook, sortOrders } from './markets/orderbook';
import { DexSample, Sampler } from './sampler';
import { ChainId, RouteWithQuotes, TradeType } from './types';

const ORDERBOOK_URL = 'https://api.0x.org/sra';

export class QuoteProvider {
  private sampler: Sampler;
  private orderbook: Orderbook;
  constructor(chainId: ChainId, provider: providers.BaseProvider) {
    this.sampler = new Sampler(chainId, provider, {});
    this.orderbook = new Orderbook(ORDERBOOK_URL);
  }
  public async getQuotesManyExactIn(
    amountIns: TokenAmount[],
    routesByLimitOrder: Route[],
    routesByProtocol: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(
      amountIns,
      routesByLimitOrder,
      routesByProtocol,
      TradeType.EXACT_INPUT
    );
  }

  public async getQuotesManyExactOut(
    amountOuts: TokenAmount[],
    routesByLimitOrder: Route[],
    routesByProtocol: Route[]
  ): Promise<RouteWithQuotes[]> {
    return this.getQuotes(
      amountOuts,
      routesByLimitOrder,
      routesByProtocol,
      TradeType.EXACT_OUTPUT
    );
  }

  private async getQuotes(
    amounts: TokenAmount[],
    routesByLimitOrder: Route[],
    routesByProtocol: Route[],
    tradeType: TradeType
  ): Promise<RouteWithQuotes[]> {
    const fillAmounts = amounts.map(amt => amt.amount);
    const samplerRoutes = routesByProtocol.map(route => {
      return {
        protocol: route.protocol,
        path: route.path.map(p => p.address),
        poolAddress: route.poolAddress,
      };
    });
    // handle limit orders first
    const routesWithQuotesByLimitOrder = await Promise.all(
      _.map(routesByLimitOrder, route => {
        return this.getQuoteForLimitOrder(amounts, route, tradeType);
      })
    );

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
        return [routesByProtocol[i], amountQuote];
      }
    );

    return [...routesWithQuotesByProtocol, ...routesWithQuotesByLimitOrder];
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
}
