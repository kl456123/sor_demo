import { Token } from './entities';
import { ChainId } from './types';

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

export const WETH9: { [chainId in ChainId]?: Token } = {
  [ChainId.MAINNET]: WETH_MAINNET,
};

// used to filter best possible pools
export const baseTokensByChain: { [chainId in ChainId]?: Token[] } = {
  [ChainId.MAINNET]: [
    USDC_MAINNET,
    USDT_MAINNET,
    WBTC_MAINNET,
    DAI_MAINNET,
    WETH_MAINNET,
  ],
};

export const TOKENS: { [chainId in ChainId]?: { [symbol: string]: Token } } = {
  [ChainId.MAINNET]: {
    USDC: USDC_MAINNET,
    USDT: USDT_MAINNET,
    WBTC: WBTC_MAINNET,
    DAI: DAI_MAINNET,
    WETH: WETH_MAINNET,
  },
};

// usd token for gas
export const usdGasTokensByChain: { [chainId in ChainId]?: Token[] } = {
  [ChainId.MAINNET]: [USDC_MAINNET, USDT_MAINNET, DAI_MAINNET],
};
