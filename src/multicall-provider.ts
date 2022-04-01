/// ////////////////////////////////////////
// query infos of tokens and pools on-chain
/// ////////////////////////////////////////
import { Interface } from '@ethersproject/abi';
import { BigNumber, providers } from 'ethers';
import _ from 'lodash';

import { valueByChainId } from './base_token';
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
  call<TFunctionParams extends unknown[] | undefined, TReturn = unknown>(
    params: CallParams<TFunctionParams>
  ): Promise<{
    blockNumber: BigNumber;
    results: Result<TReturn>[];
  }>;
}

const UNISWAP_MULTICALL_ADDRESS = '0x1F98415757620B543A52E61c46B32eB19261F984';
const contractAddressByChain = valueByChainId<string>(
  {
    [ChainId.MAINNET]: UNISWAP_MULTICALL_ADDRESS,
  },
  UNISWAP_MULTICALL_ADDRESS
);

type Result<TReturn> = {
  success: boolean;
  result: TReturn | string;
};

export class MulticallProvider implements IMulticallProvider {
  private multicallContract: UniswapInterfaceMulticall;
  protected gasLimitPerCall: number;
  protected multicallChunk: number;
  constructor(
    protected chainId: ChainId,
    protected provider: providers.BaseProvider
  ) {
    this.multicallContract = UniswapInterfaceMulticall__factory.connect(
      contractAddressByChain[this.chainId],
      this.provider
    );
    this.gasLimitPerCall = 10_000_000;
    this.multicallChunk = 100;
  }

  public async call<
    TFunctionParams extends unknown[] | undefined,
    TReturn = unknown
  >(
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
    const callsChunks = _.chunk(calls, this.multicallChunk);
    const resultChunks = await Promise.all(
      _.map(callsChunks, async callsChunk => {
        const result = await this.multicallContract.callStatic.multicall(
          callsChunk,
          {
            blockTag: blockNumberOverride,
          }
        );
        return result;
      })
    );
    // blocknumber is all the same
    const blockNumbers = resultChunks.map(result => result.blockNumber);
    const blockNumber = blockNumbers[0];
    const aggregateResults = _.flatMap(
      resultChunks,
      result => result.returnData
    );

    const results: Result<TReturn>[] = [];
    for (let i = 0; i < aggregateResults.length; ++i) {
      const { success, returnData } = aggregateResults[i];
      // check if failed
      if (!success || returnData.length <= 2) {
        // logger;
        logger.debug(`Invalid result calling ${functionName}`);
        results.push({
          success: false,
          result: returnData,
        });
        continue;
      }
      results.push({
        success: true,
        result: contractInterface.decodeFunctionResult(
          functionName,
          returnData
        ) as unknown as TReturn,
      });
    }

    return { results, blockNumber };
  }
}
