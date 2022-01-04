import _ from 'lodash';
import {
  StaticFileSubgraphProvider,
  SubgraphPoolProvider,
} from '../src/subgraph_provider';
import { ChainId } from '../src/types';

const expectAddress = (address: string) => {
  expect(address.length).toEqual(42);
  expect(address.slice(0, 2)).toEqual('0x');
};

describe('test subgraph provider', () => {
  let subgraphPoolProvider: SubgraphPoolProvider;
  beforeAll(() => {
    subgraphPoolProvider = new SubgraphPoolProvider(ChainId.MAINNET);
  });

  test('succeeds to retrieve pools from subgraph', async () => {
    // it costs about 30s to get results
    const rawPools = await subgraphPoolProvider.getPools();
    expect(rawPools.length).toBeGreaterThan(0);
  });
});

describe.only('test static file subgraph provider', () => {
  let subgraphPoolProvider: StaticFileSubgraphProvider;
  beforeAll(() => {
    subgraphPoolProvider = new StaticFileSubgraphProvider();
  });
  test('get pools from local static file', async () => {
    const rawPools = await subgraphPoolProvider.getPools();
    expect(rawPools.length).toBeGreaterThan(0);

    // assert sample
    const rawPool = _.sample(rawPools)!;
    expect(rawPool.supply).toBeGreaterThan(0);
    expect(rawPool.reserve).toBeGreaterThan(0);
    expectAddress(rawPool.id);
    expectAddress(rawPool.token0.id);
    expectAddress(rawPool.token1.id);
  });
});
