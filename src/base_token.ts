import { Token } from './entities';
import { ChainId } from './types';

const USDC_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
  symbol: 'USDC',
});

const USDT_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  decimals: 6,
  symbol: 'USDT',
});

const WBTC_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  decimals: 8,
  symbol: 'WBTC',
});

const DAI_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
  symbol: 'DAI',
});

const WETH_MAINNET = new Token({
  chainId: ChainId.MAINNET,
  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  decimals: 18,
  symbol: 'WETH',
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
