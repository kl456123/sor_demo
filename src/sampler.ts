// wrapper for erc20 bridge sampler contract

import { Contract } from 'ethers';

import samplerJsonAbi from './abis/erc20BridgeSampler';

export class Sampler {
  private contract: Contract;
  constructor(samplerAddress: string) {
    this.contract = new Contract(samplerAddress, samplerJsonAbi);
  }
  public async executeBatch() {
    return;
  }
}
