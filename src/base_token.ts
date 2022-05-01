import { Token } from './entities';
import { ChainId } from './types';

export function valueByChainId<T>(
  rest: Partial<{ [key in ChainId]: T }>,
  defaultValue: T
) {
  return {
    [ChainId.MAINNET]: defaultValue,
    [ChainId.BSC]: defaultValue,
    [ChainId.RINKEBY]: defaultValue,
    [ChainId.ROPSTEN]: defaultValue,
    [ChainId.POLYGON]: defaultValue,
    ...(rest || {}),
  };
}

const ETH_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  decimals: 18,
  symbol: 'ETH',
  name: 'ETH',
});

const USDC_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 6,
  symbol: 'USDC',
  name: 'USDC',
});

const USDT_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  decimals: 6,
  symbol: 'USDT',
  name: 'USDT',
});

const WBTC_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  decimals: 8,
  symbol: 'WBTC',
  name: 'WBTC',
});

const DAI_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  decimals: 18,
  symbol: 'DAI',
  name: 'DAI',
});

const WETH_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  decimals: 18,
  symbol: 'WETH',
  name: 'WETH',
});

// some uncommon tokens
const MATIC_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  decimals: 18,
  symbol: 'MATIC',
  name: 'Matic Token',
});

const UNI_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  decimals: 18,
  symbol: 'UNI',
  name: 'Uniswap',
});

const AAVE_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  decimals: 18,
  symbol: 'AAVE',
  name: 'aave',
});

const YFI_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
  decimals: 18,
  symbol: 'YFI',
  name: 'yearn.finance',
});

const AVAX_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x1ce0c2827e2ef14d5c4f29a091d735a204794041',
  symbol: 'AVAX',
  name: 'Binance-Peg Avalanche Token',
  decimals: 18,
});

export const WETH9 = valueByChainId<Token>({}, WETH_MAINNET);

// used to filter best possible pools
export const baseTokensByChain = valueByChainId<Token[]>(
  {
    [ChainId.MAINNET]: [
      USDC_MAINNET,
      USDT_MAINNET,
      WBTC_MAINNET,
      DAI_MAINNET,
      WETH_MAINNET,
    ],
  },
  []
);

export const TOKENS = valueByChainId<{ [name: string]: Token }>(
  {
    [ChainId.MAINNET]: {
      USDC: USDC_MAINNET,
      ETH: ETH_MAINNET,
      USDT: USDT_MAINNET,
      WBTC: WBTC_MAINNET,
      DAI: DAI_MAINNET,
      WETH: WETH_MAINNET,
      MATIC: MATIC_MAINNET,
      UNI: UNI_MAINNET,
      AAVE: AAVE_MAINNET,
      AVAX: AVAX_MAINNET,
      YFI: YFI_MAINNET,
    },
  },
  {}
);

// usd token for gas
export const usdGasTokensByChain = valueByChainId<Token[]>(
  {
    [ChainId.MAINNET]: [USDC_MAINNET, USDT_MAINNET, DAI_MAINNET],
  },
  []
);
