import invariant from 'tiny-invariant';

import { TOKENS } from '../base_token';
import { Token } from '../entities';
import { ChainId } from '../types';

export type CurveInfo = {
  poolAddress: string;
  tokens: Token[];
  sellQuoteFunctionSelector: CurveFunctionSelectors;
  buyQuoteFunctionSelector: CurveFunctionSelectors;
  exchangeFunctionSelector?:CurveFunctionSelectors;
};

const tokens = TOKENS[ChainId.MAINNET]!;

const TUSD = new Token({
  chainId: ChainId.MAINNET,
  address: '0x0000000000085d4780b73119b644ae5ecd22b376',
  decimals: 6,
  symbol: 'TUSD',
  name: 'TUSD',
});

const SUSD = new Token({
  chainId: ChainId.MAINNET,
  address: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
  decimals: 6,
  symbol: 'SUSD',
  name: 'SUSD',
});

const CRV = new Token({
  chainId: ChainId.MAINNET,
  address: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B',
  decimals: 18,
  symbol: 'CRV',
  name: 'CRV',
});

export enum CurveFunctionSelectors {
  None = '0x00000000',
  exchange = '0x3df02124',
  exchange_underlying = '0xa6417ed6',
  get_dy_underlying = '0x07211ef7',
  get_dx_underlying = '0x0e71d1b9',
  get_dy = '0x5e0d443f',
  get_dx = '0x67df02ca',
  // Curve V2
  exchange_v2 = '0x5b41b908',
  exchange_underlying_v2 = '0x65b2489b',
  get_dy_v2 = '0x556d6e9f',
  get_dy_underlying_v2 = '0x85f11d1e',
}

export const CURVE_V2_POOLS = {
      tricrypto: '0x80466c64868e1ab14a1ddf27a676c3fcbe638fe5',
      tricrypto2: '0xd51a44d3fae010294c616388b506acda1bfaae46',
      cvxeth: '0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4',
};

export const MAINNET_CURVE_INFOS: Record<string, CurveInfo> = {
  DaiUsdc: {
    poolAddress: '0xa2b47e3d5c44877cca798226b7b8118f9bfb7a56',
    tokens: [tokens.DAI, tokens.USDC],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // lending pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
  },
  DaiUsdcUsdtTusd: {
    poolAddress: '0x45f783cce6b7ff23b2ab2d70e416cdb7d6055f51',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, TUSD],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // meta pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
  },
  DaiUsdcUsdtSusd: {
    poolAddress: '0xa5407eae9ba41422680e2e00537571bcc53efbfd',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, SUSD],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // meta pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
  },
  TriPool: {
    poolAddress: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy, // base pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
  },
};

export function getCurveInfosForTokens(
  takerToken: string,
  makerToken: string
): CurveInfo[] {
  return Object.values(MAINNET_CURVE_INFOS).filter(c =>
    [makerToken, takerToken].every(a =>
      c.tokens.some(b => b.address.toLowerCase() === a.toLowerCase())
    )
  );
}

export function getCurveInfosForPool(poolAddress: string): CurveInfo {
  const curveInfos = Object.values(MAINNET_CURVE_INFOS).filter(
    c => c.poolAddress === poolAddress.toLowerCase()
  );
  invariant(curveInfos.length == 1, 'CurveInfo');
  return curveInfos[0];
}


export const CURVE_V2_MAINNET_INFOS: { [name: string]: CurveInfo } = {
      [CURVE_V2_POOLS.tricrypto]: {
                tokens: [tokens.USDT, tokens.WBTC, tokens.WETH],
                poolAddress: CURVE_V2_POOLS.tricrypto,
                exchangeFunctionSelector: CurveFunctionSelectors.exchange_v2,
                sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_v2,
                buyQuoteFunctionSelector: CurveFunctionSelectors.None,
            },
      [CURVE_V2_POOLS.tricrypto2]: {
                tokens: [tokens.USDT, tokens.WBTC, tokens.WETH],
                poolAddress: CURVE_V2_POOLS.tricrypto2,
                exchangeFunctionSelector: CurveFunctionSelectors.exchange_v2,
                sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_v2,
                buyQuoteFunctionSelector: CurveFunctionSelectors.None,
            },
    [CURVE_V2_POOLS.cvxeth]:{
        tokens: [tokens.WETH, CRV],
        poolAddress:CURVE_V2_POOLS.cvxeth,
        exchangeFunctionSelector: CurveFunctionSelectors.exchange_v2,
        sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_v2,
        buyQuoteFunctionSelector: CurveFunctionSelectors.None,

    },
  };
