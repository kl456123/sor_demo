import invariant from 'tiny-invariant';

import { TOKENS } from '../base_token';
import { Token } from '../entities';
import { ChainId } from '../types';

export type CurveInfo = {
  poolAddress: string;
  tokens: Token[];
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

export const MAINNET_CURVE_INFOS: Record<string, CurveInfo> = {
  DaiUsdc: {
    poolAddress: '0xa2b47e3d5c44877cca798226b7b8118f9bfb7a56',
    tokens: [tokens.DAI, tokens.USDC],
  },
  DaiUsdcUsdtTusd: {
    poolAddress: '0x45f783cce6b7ff23b2ab2d70e416cdb7d6055f51',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, TUSD],
  },
  DaiUsdcUsdtSusd: {
    poolAddress: '0xa5407eae9ba41422680e2e00537571bcc53efbfd',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, SUSD],
  },
  TriPool: {
    poolAddress: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT],
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
