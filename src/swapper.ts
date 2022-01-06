import { ethers } from 'ethers';

export class Swapper {
  public readonly provider: ethers.providers.BaseProvider;
  constructor(provider: ethers.providers.BaseProvider) {
    this.provider = provider;
  }
}
