import { constants, utils } from 'ethers';

import { ChainId, Protocol } from './types';
import { WETH9 } from './base_token';

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

export const NULL_ADDRESS = constants.AddressZero;
export const uniswapV2LikeRouterAddress = (
  chainId: ChainId,
  protocol: Protocol
): string => {
  switch (protocol) {
    case Protocol.UniswapV2:
      return uniswapV2RouterByChain[chainId] ?? NULL_ADDRESS;
    case Protocol.SushiSwap:
      return sushiRouterByChain[chainId] ?? NULL_ADDRESS;
    default:
      throw new Error(`unknown UniswapV2 like protocol ${protocol}`);
  }
};

export const DODOV2_FACTORIES_BY_CHAIN_ID: valueByChain<string[]> = {
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

export const BALANCER_V2_VAULT_ADDRESS_BY_CHAIN: valueByChain<string> = {
  [ChainId.MAINNET]: '0xba12222222228d8ba445958a75a0704d566bf2c8',
  [ChainId.POLYGON]: '0xba12222222228d8ba445958a75a0704d566bf2c8',
};

export const BALANCER_V2_SUBGRAPH_URL_BY_CHAIN: valueByChain<string> = {
  [ChainId.POLYGON]:
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
  [ChainId.MAINNET]:
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
};

export const DODOV1_CONFIG_BY_CHAIN_ID: valueByChain<{
  helper: string;
  registry: string;
}> = {
  [ChainId.MAINNET]: {
    helper: '0x533da777aedce766ceae696bf90f8541a4ba80eb',
    registry: '0x3A97247DF274a17C59A3bd12735ea3FcDFb49950',
  },
  [ChainId.BSC]: {
    helper: '0x0f859706aee7fcf61d5a8939e8cb9dbb6c1eda33',
    registry: '0xca459456a45e300aa7ef447dbb60f87cccb42828',
  },
  [ChainId.POLYGON]: {
    helper: '0xdfaf9584f5d229a9dbe5978523317820a8897c5a',
    registry: '0x357c5e9cfa8b834edcef7c7aabd8f9db09119d11',
  },
};

export const UNISWAPV3_CONFIG_BY_CHAIN_ID: valueByChain<{
  quoter: string;
  router: string;
}> = {
  [ChainId.MAINNET]: {
    quoter: '0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6',
    router: '0xe592427a0aece92de3edee1f18e0157c05861564',
  },
  [ChainId.ROPSTEN]: {
    quoter: '0x2f9e608fd881861b8916257b76613cb22ee0652c',
    router: '0x03782388516e94fcd4c18666303601a12aa729ea',
  },
};

export const KYBER_CONFIG_BY_CHAIN_ID: valueByChain<{
    networkProxy: string,
    hintHandler:string,
    weth:string
}> = {
          [ChainId.MAINNET]: {
              networkProxy: '0x9aab3f75489902f3a48495025729a0af77d4b11e',
              hintHandler: '0xa1C0Fa73c39CFBcC11ec9Eb1Afc665aba9996E2C',
              weth: WETH9[ChainId.MAINNET]!.address,
          },
      };


export const BANCOR_REGISTRY_BY_CHAIN_ID : valueByChain<string> =
      {
                [ChainId.MAINNET]: '0x52Ae12ABe5D8BD778BD5397F99cA900624CfADD4',
            };

export const MAKER_PSM_INFO_BY_CHAIN_ID : valueByChain<{gemTokenAddress:string, ilkIdentifier:string, psmAddress:string}> =
      {
          [ChainId.MAINNET]: {
              // Currently only USDC is supported
              gemTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              ilkIdentifier: utils.formatBytes32String('PSM-USDC-A'),
              psmAddress: '0x89b78cfa322f6c5de0abceecab66aee45393cc5a',
          },
      };
