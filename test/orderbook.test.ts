// import { Orderbook } from '@0x/orderbook';
// import { HttpClient } from '@0x/connect';
import { assert } from '@0x/assert';
import { schemas } from '@0x/json-schemas';
import axios from 'axios';

import { Orderbook } from '../src/markets/orderbook';

describe('limit order test', () => {
  describe('orderbook api test', () => {
    test('test to fetch data by using axios', async () => {
      // const orderbook = Orderbook.getOrderbookForPollingProvider({
      // httpEndpoint: 'https://api.0x.org/orderbook/v1',
      // pollingIntervalMs: 5000
      // });
      // const makerAssetData = '0xf47261b000000000000000000000000089d24a6b4ccb1b6faa2625fe562bdd9a23260359'; // const takerAssetData = '0xf47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
      // const orders = await orderbook.getOrdersAsync(makerAssetData, takerAssetData);
      // const assetDatas = await orderbook.getAvailableAssetDatasAsync();
      // console.log(assetDatas);
      // const httpClient = new HttpClient('https://api.0x.org/sra/v3');
      // const assetPairs = await httpClient.getAssetPairsAsync({perPage: 10});
      // console.log(assetPairs);
      // const orders = await httpClient.getOrdersAsync({
      // perPage: 10,
      // page: 3
      // });
      // console.log(orders);

      // total orders
      // const response = await axios.get('https://api.0x.org/sra/orders?page=3&perPage=20');
      // order for asset pairs
      const baseUrl = 'https://api.0x.org/sra';
      const Eth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
      const Usdt = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      const params = `/orders?makerToken=${Eth}&takerToken=${Usdt}`;
      // const params = `/orderbook/v1?quoteToken=${Eth}&baseToken=${Usdt}`;
      const req = `${baseUrl}${params}`;
      console.log(req);
      const response = await axios.get(req);
      const { data } = response;
      // validate data
      assert.doesConformToSchema(
        'orderSchema',
        data.records[0].order,
        schemas.orderSchema
      );
      expect(data.records.length).toBeGreaterThan(0);
    });

    test('test to fetch data by using orderbook', async () => {
      const baseUrl = 'https://api.0x.org/sra';
      const orderbook = new Orderbook(baseUrl);
      const makerAssetData = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
      const takerAssetData = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      const orders = await orderbook.getOrdersAsync(
        makerAssetData,
        takerAssetData
      );
      expect(orders.length).toBeGreaterThan(0);
      console.log(orders.length);
    });
  });
});
