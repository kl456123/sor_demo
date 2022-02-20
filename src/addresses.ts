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


export const DODOV2_FACTORIES_BY_CHAIN_ID: valueByChain<string[]> =
      {
          [ChainId.MAINNET]: [
              '0x6b4fa0bc61eddc928e0df9c7f01e407bfcd3e5ef', // Private Pool
              '0x72d220ce168c4f361dd4dee5d826a01ad8598f6c', // Vending Machine
              '0x6fddb76c93299d985f4d3fc7ac468f9a168577a4', // Stability Pool
          ],
          [ChainId.BSC]: [
              '0xafe0a75dffb395eaabd0a7e1bbbd0b11f8609eef', // Private Pool
              '0x790b4a80fb1094589a3c0efc8740aa9b0c1733fb', // Vending Machine
              '0x0fb9815938ad069bf90e14fe6c596c514bede767', // Stability Pool
          ],
          [ChainId.POLYGON]: [
              '0x95e887adf9eaa22cc1c6e3cb7f07adc95b4b25a8', // Private Pool
              '0x79887f65f83bdf15bcc8736b5e5bcdb48fb8fe13', // Vending Machine
              '0x43c49f8dd240e1545f147211ec9f917376ac1e87', // Stability Pool
          ],
      };
