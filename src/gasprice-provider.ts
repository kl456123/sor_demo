// get gas price from gas station network
import retry from 'async-retry';
import axios from 'axios';
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
    const response = await retry(
      async () => {
        return axios.get(this.url);
      },
      { retries: 1 }
    );
    const { data: gasPriceResponse, status } = response;
    if (status !== 200) {
      throw new Error(`Unable to get gas price form ${this.url}`);
    }

    logger.info(`${gasPriceResponse}`);
    const { fast, blockNum: blockNumber } = gasPriceResponse;

    const gasPriceWei = BigNumber.from(fast)
      .div(BigNumber.from(10))
      .mul(BigNumber.from(10).pow(9));

    const gasPrice: GasPrice = { gasPriceWei, blockNumber };
    return gasPrice;
  }
}
