/// ////////////////////////////////////////
// query infos of tokens and pools on-chain
/// ////////////////////////////////////////
import { Interface } from '@ethersproject/abi';
import { BigNumber, providers } from 'ethers';
import _ from 'lodash';

import { logger } from './logging';
import { ChainId } from './types';
import {
  UniswapInterfaceMulticall,
  UniswapInterfaceMulticall__factory,
} from './types/v3';

export type CallParams<TFunctionParams> = {
  addresses: string[];
  contractInterface: Interface;
  functionParams: TFunctionParams[];
  functionName: string;
  blockNumber?: number;
};

export interface IMulticallProvider {
  call<TFunctionParams extends any[] | undefined, TReturn = any>(
    params: CallParams<TFunctionParams>
  ): Promise<{
    blockNumber: BigNumber;
    results: Result<TReturn>[];
  }>;
}

const UNISWAP_MULTICALL_ADDRESS = '0x1F98415757620B543A52E61c46B32eB19261F984';
const contractAddressByChain: { [chain in ChainId]?: string } = {
  [ChainId.MAINNET]: UNISWAP_MULTICALL_ADDRESS,
};

type Result<TReturn> = {
  result: TReturn;
};

export class MulticallProvider implements IMulticallProvider {
  private multicallContract: UniswapInterfaceMulticall;
  protected gasLimitPerCall: number;
  constructor(
    protected chainId: ChainId,
    protected provider: providers.BaseProvider
  ) {
    this.multicallContract = UniswapInterfaceMulticall__factory.connect(
      contractAddressByChain[this.chainId]!,
      this.provider
    );
    this.gasLimitPerCall = 1_000_000;
  }

  public async call<TFunctionParams extends any[] | undefined, TReturn = any>(
    params: CallParams<TFunctionParams>
  ): Promise<{
    blockNumber: BigNumber;
    results: Result<TReturn>[];
  }> {
    const {
      addresses,
      contractInterface,
      functionName,
      functionParams,
      blockNumber: blockNumberOverride,
    } = params;
    const calls = _.map(addresses, (address, i) => {
      const callData = contractInterface.encodeFunctionData(
        functionName,
        functionParams[i]
      );
      return {
        target: address,
        callData,
        gasLimit: this.gasLimitPerCall,
      };
    });

    const { blockNumber, returnData: aggregateResults } =
      await this.multicallContract.callStatic.multicall(calls, {
        blockTag: blockNumberOverride,
      });
    const results: Result<TReturn>[] = [];
    for (let i = 0; i < aggregateResults.length; ++i) {
      const { success, returnData } = aggregateResults[i];
      // check if failed
      if (!success || returnData.length <= 2) {
        logger.debug(`Invalid result calling ${functionName}`);
        continue;
      }
      results.push({
        result: contractInterface.decodeFunctionResult(
          functionName,
          returnData
        ) as unknown as TReturn,
      });
    }

    return { results, blockNumber };
  }
}
