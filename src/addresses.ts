import { constants } from 'ethers';
import { ChainId, Protocol } from './types';

// use contracts from 0x protocol for more liquidity sources
export const contractAddressesByChain: {
  [chainId in ChainId]?: { [name: string]: string };
} = {
  [ChainId.MAINNET]: {
    quoter: '0xd8c38704c9937ea3312de29f824b4ad3450a5e61',
    swapper: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
};

export type valueByChain<Type> = {
  [chainId in ChainId]?: Type;
};

export const uniswapV2RouterByChain: valueByChain<string> = {
  [ChainId.MAINNET]: '0xf164fc0ec4e93095b804a4795bbe1e041497b92a',
  [ChainId.ROPSTEN]: '0xf164fc0ec4e93095b804a4795bbe1e041497b92a',
};

export const sushiRouterByChain: valueByChain<string> = {
  [ChainId.MAINNET]: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
  [ChainId.ROPSTEN]: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
};

export const uniswapV2LikeRouterAddress = (
  chainId: ChainId,
  protocol: Protocol
): string => {
  const NULL_ADDRESS = constants.AddressZero;
  switch (protocol) {
    case Protocol.UniswapV2:
      return uniswapV2RouterByChain[chainId] ?? NULL_ADDRESS;
    case Protocol.SushiSwap:
      return sushiRouterByChain[chainId] ?? NULL_ADDRESS;
    default:
      throw new Error(`unknown UniswapV2 like protocol ${protocol}`);
  }
};
