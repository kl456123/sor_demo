import { assert } from '@0x/assert';
import { schemas } from '@0x/json-schemas';
import {
  AssetPairsItem,
  AssetPairsResponse,
  Order,
  OrdersResponse,
  SignedOrder,
} from '@0x/types';
import { BigNumber } from '@0x/utils';
import axios from 'axios';
import _ from 'lodash';

import { logger } from '../logging';

// orderbook to utilize zerox liquidity

export interface SignedOrderWithFillableAmounts extends SignedOrder {
  fillableMakerAssetAmount: BigNumber;
  fillableTakerAssetAmount: BigNumber;
  fillableTakerFeeAmount: BigNumber;
}

const PER_PAGE_DEFAULT = 100;

export class Orderbook {
  constructor(
    private readonly httpEndpoint: string,
    private readonly perPage: number = PER_PAGE_DEFAULT
  ) {
    this.perPage = perPage;
  }

  public async getOrdersAsync(
    makerToken: string,
    takerToken: string
  ): Promise<SignedOrder[]> {
    const requestOpts = {
      perPage: this.perPage,
      makerToken,
      takerToken,
    };

    const params = requestOpts;
    const path = '/orders';
    const url = `${this.httpEndpoint}${path}`;
    const response = await axios.get(url, { params });
    const { data, status } = response;
    // console.log(response);
    if (status != 200) {
      logger.error(`${response}`);
      throw new Error(`Unable to get data from ${this.httpEndpoint}`);
    }

    // validate data first
    assert.doesConformToSchema(
      'paginatedCollectionSchema',
      data,
      schemas.paginatedCollectionSchema
    );

    const ordersResponse = data as OrdersResponse;
    const { records } = ordersResponse;
    const orders = records.map(o => o.order);
    assert.doesConformToSchema('ordersSchema', orders, schemas.ordersSchema);

    return orders;
  }

  // public async getOrderbookAsync(){
  // }

  // public async addOrdersAsync(){
  // }

  public async getAvailableAssetDatasAsync(): Promise<AssetPairsItem[]> {
    const requestOpts = {
      perPage: this.perPage,
    };

    const params = requestOpts;
    const path = '/asset_paris';
    const url = `${this.httpEndpoint}${path}`;
    const response = await axios.get(url, { params });
    const { data, status } = response;
    if (status != 200) {
      logger.error(`${response}`);
      throw new Error(`Unable to get data from ${this.httpEndpoint}`);
    }
    const assetPairsResponse = data as AssetPairsResponse;
    const { total, records, perPage } = assetPairsResponse;
    console.log(total, perPage);
    return records;
  }
}

export function sortOrders<T extends Order>(
  orders: T[],
  descendingForBuy: boolean
): T[] {
  // convert some fields to bignumber
  const copiedOrders = _.cloneDeep(
    _.map(orders, order =>
      convertToBigNumber(order, [
        'makerAssetAmount',
        'makerFee',
        'takerAssetAmount',
        'takerFee',
        'expirationTimeSeconds',
        'salt',
      ])
    )
  );
  copiedOrders.sort((firstOrder, secondOrder) => {
    const firstOrderRate = getTakerFeeAdjustedRateOfOrder(firstOrder);
    const secondOrderRate = getTakerFeeAdjustedRateOfOrder(secondOrder);
    return firstOrderRate.comparedTo(secondOrderRate);
  });
  if (descendingForBuy) {
    return copiedOrders;
  } else {
    return copiedOrders.reverse();
  }
}

// taker should pay fee with takerToken
function isOrderTakerFeePaybleWithTakerAsset<T extends Order>(order: T) {
  return !order.takerFee.isZero();
}

function isOrderMakerFeePaybleWithTakerAsset<T extends Order>(order: T) {
  return !order.makerFee.isZero();
}

function getTakerFeeAdjustedRateOfOrder(order: Order): BigNumber {
  const adjustedMakerAssetAmount = isOrderMakerFeePaybleWithTakerAsset(order)
    ? order.makerAssetAmount.minus(order.makerFee)
    : order.makerAssetAmount;
  const adjustedTakerAssetAmount = isOrderTakerFeePaybleWithTakerAsset(order)
    ? order.takerAssetAmount.plus(order.takerFee)
    : order.takerAssetAmount;
  return adjustedTakerAssetAmount.div(adjustedMakerAssetAmount);
}

function convertToBigNumber(obj: any, fields: string[]) {
  const result = _.assign({}, obj);
  _.each(fields, field => {
    _.update(result, field, (value: string | undefined) => {
      if (value === undefined) {
        throw new Error(
          `Could not find field: ${field} when converting to BigNumber`
        );
      }
      return new BigNumber(value);
    });
  });
  return result;
}
