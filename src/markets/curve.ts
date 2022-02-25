import invariant from 'tiny-invariant';

export type CurveInfo = {
  poolAddress: string;
  tokens: string[];
};

export const MAINNET_CURVE_INFOS: { [name: string]: CurveInfo } = {
  DaiUsdc: {
    poolAddress: '0xa2b47e3d5c44877cca798226b7b8118f9bfb7a56',
    tokens: [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    ],
  },
  DaiUsdcUsdtTusd: {
    poolAddress: '0x45f783cce6b7ff23b2ab2d70e416cdb7d6055f51',
    tokens: [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '0x0000000000085d4780b73119b644ae5ecd22b376',
    ],
  },
  DaiUsdcUsdtSusd: {
    poolAddress: '0xa5407eae9ba41422680e2e00537571bcc53efbfd',
    tokens: [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    ],
  },
  TriPool: {
    poolAddress: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
    tokens: [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ],
  },
};

export function getCurveInfosForTokens(
  takerToken: string,
  makerToken: string
): CurveInfo[] {
  return Object.values(MAINNET_CURVE_INFOS).filter(c =>
    [makerToken, takerToken].every(t => c.tokens.includes(t.toLowerCase()))
  );
}

export function getCurveInfosForPool(poolAddress: string): CurveInfo {
  const curveInfos = Object.values(MAINNET_CURVE_INFOS).filter(
    c => c.poolAddress === poolAddress.toLowerCase()
  );
  invariant(curveInfos.length == 1, 'CurveInfo');
  return curveInfos[0];
}
