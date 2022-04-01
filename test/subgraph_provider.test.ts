import _ from 'lodash';

import {
  UniswapV2StaticFileSubgraphProvider,
  UniswapV2SubgraphPoolProvider,
} from '../src/markets/uniswapv2_subgraph_provider';
import { ChainId } from '../src/types';

const expectAddress = (address: string) => {
  expect(address.length).toEqual(42);
  expect(address.slice(0, 2)).toEqual('0x');
};

describe('test subgraph provider', () => {
  let subgraphPoolProvider: UniswapV2SubgraphPoolProvider;
  beforeAll(() => {
    subgraphPoolProvider = new UniswapV2SubgraphPoolProvider(ChainId.MAINNET);
  });

  test('succeeds to retrieve pools from subgraph', async () => {
    // it costs about 30s to get results
    const rawPools = await subgraphPoolProvider.getPools();
    expect(rawPools.length).toBeGreaterThan(0);
  });
});

describe.only('test static file subgraph provider', () => {
  let subgraphPoolProvider: UniswapV2StaticFileSubgraphProvider;
  beforeAll(() => {
    subgraphPoolProvider = new UniswapV2StaticFileSubgraphProvider();
  });
  test('get pools from local static file', async () => {
    const rawPools = await subgraphPoolProvider.getPools();
    expect(rawPools.length).toBeGreaterThan(0);

    // assert sample
    const rawPool = _.sample(rawPools)!;
    expect(rawPool.reserve).toBeGreaterThan(0);
    expectAddress(rawPool.id);
    expectAddress(rawPool.tokens[0].address);
    expectAddress(rawPool.tokens[1].address);
  });
});
