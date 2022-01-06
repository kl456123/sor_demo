import { SourceFilters } from '../src/source_filters';
import { Protocol } from '../src/types';

describe('test source', () => {
  test('simple test', () => {
    expect(new SourceFilters().sources().length).toEqual(0);
    expect(SourceFilters.all().sources().length).toEqual(
      Object.values(Protocol).length
    );
  });
  test('merge two sources', () => {
    const sourceFiltersA = SourceFilters.all();
    const sourceFiltersB = new SourceFilters([Protocol.UniswapV2]);
    const sourceFilters = sourceFiltersB.merge(sourceFiltersA);
    expect(sourceFilters.sources().length).toEqual(
      sourceFiltersB.sources().length
    );
  });
});
