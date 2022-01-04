// get gas price from gas station network
import { BigNumber } from 'ethers';

export type GasPrice = {
  gasWeiPrice: BigNumber;
  blockNumber: number;
};

export abstract class IGasPriceProvider {
  public abstract getGasPrice(): Promise<GasPrice>;
}

export class GasPriceProvider implements IGasPriceProvider {
  public async getGasPrice(): Promise<GasPrice> {
    // mock data
    const blockNumber = 10000;
    const gasWeiPrice = BigNumber.from('100000000');
    const gasPrice: GasPrice = { gasWeiPrice, blockNumber };
    return gasPrice;
  }
}
