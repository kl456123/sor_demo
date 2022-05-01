// get gas price from gas station network
import { BigNumber } from 'ethers';

import { logger } from './logging';

export type GasPrice = {
  gasPriceWei: BigNumber;
  blockNumber: number;
};

export abstract class IGasPriceProvider {
  public abstract getGasPrice(): Promise<GasPrice>;
}

export class ETHGasStationGasPriceProvider extends IGasPriceProvider {
  constructor(private readonly url: string) {
    super();
  }

  public async getGasPrice(): Promise<GasPrice> {
    // mock data
    logger.info(`gasPriceResponse: ${this.url}`);
    try {
      // const { data, status } = await axios.get(this.url);

      // logger.info(`gasPriceResponse: ${data}`);
      const { fast, blockNum: blockNumber } = { fast: 360, blockNum: 14460251 };

      const gasPriceWei = BigNumber.from(fast)
        .div(BigNumber.from(10))
        .mul(BigNumber.from(10).pow(9));

      const gasPrice: GasPrice = { gasPriceWei, blockNumber };
      return gasPrice;
    } catch (error) {
      throw new Error(`Unable to get gas price form ${this.url}: ${error}`);
    }
  }
}
