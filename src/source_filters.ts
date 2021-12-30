import _ from 'lodash';

import { ERC20BridgeSource } from './types';

export default class SourceFilters {
  private readonly validSources: ERC20BridgeSource[];

  private readonly excludedSources: ERC20BridgeSource[];

  private readonly includedSources: ERC20BridgeSource[];

  public static all(): SourceFilters {
    return new SourceFilters(Object.values(ERC20BridgeSource));
  }

  constructor(
    validSources: ERC20BridgeSource[] = [],
    excludedSources: ERC20BridgeSource[] = [],
    includedSources: ERC20BridgeSource[] = []
  ) {
    this.validSources = _.uniq(validSources);
    this.excludedSources = _.uniq(excludedSources);
    this.includedSources = _.uniq(includedSources);
  }

  public isAllowed(source: ERC20BridgeSource): boolean {
    // source is allowed when valid sources is empty
    if (this.validSources.length > 0 && !this.validSources.includes(source)) {
      return false;
    }

    if (this.excludedSources.includes(source)) {
      return false;
    }

    // source is allowed when included sources is empty
    if (
      this.includedSources.length > 0 &&
      !this.includedSources.includes(source)
    ) {
      return false;
    }
    return true;
  }

  public sources(): ERC20BridgeSource[] {
    return this.validSources.filter(s => this.isAllowed(s));
  }

  public exclude(
    sources: ERC20BridgeSource | ERC20BridgeSource[]
  ): SourceFilters {
    return new SourceFilters(
      this.validSources,
      [
        ...this.excludedSources,
        ...(Array.isArray(sources) ? sources : [sources]),
      ],
      this.includedSources
    );
  }

  public include(
    sources: ERC20BridgeSource | ERC20BridgeSource[]
  ): SourceFilters {
    return new SourceFilters(this.validSources, this.excludedSources, [
      ...this.includedSources,
      ...(Array.isArray(sources) ? sources : [sources]),
    ]);
  }

  public merge(other: SourceFilters): SourceFilters {
    let { validSources } = this;
    if (validSources.length === 0) {
      validSources = other.validSources;
    } else if (validSources.length !== 0) {
      validSources = validSources.filter(s => other.validSources.includes(s));
    }

    return new SourceFilters(
      validSources,
      [...this.excludedSources, ...other.excludedSources],
      [...this.includedSources, ...other.includedSources]
    );
  }
}
