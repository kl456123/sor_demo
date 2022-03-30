import invariant from 'tiny-invariant';

import { TOKENS } from '../base_token';
import { Token } from '../entities';
import { ChainId, Protocol } from '../types';

export type CurveInfo = {
  poolAddress: string;
  tokens: Token[];
  sellQuoteFunctionSelector: CurveFunctionSelectors;
  buyQuoteFunctionSelector: CurveFunctionSelectors;
  exchangeFunctionSelector?: CurveFunctionSelectors;
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

export const CURVE_POOLS = {
      compound: '0xa2b47e3d5c44877cca798226b7b8118f9bfb7a56', // 0.Compound
      // 1.USDT is dead
      PAX: '0x06364f10b501e868329afbc005b3492902d6c763', // 2.PAX
      // 3.y is dead
      // 3.bUSD is dead
      sUSD: '0xa5407eae9ba41422680e2e00537571bcc53efbfd', // 5.sUSD
      renBTC: '0x93054188d876f558f4a66b2ef1d97d16edf0895b', // 6.ren
      sBTC: '0x7fc77b5c7614e1533320ea6ddc2eb61fa00a9714', // 7.sbtc
      HBTC: '0x4ca9b3063ec5866a4b82e437059d2c43d1be596f', // 8.hbtc
      TRI: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7', // 9.3pool
      GUSD: '0x4f062658eaaf2c1ccf8c8e36d6824cdf41167956', // 10.gusd
      HUSD: '0x3ef6a01a0f81d6046290f3e2a8c5b843e738e604', // 11.husd
      // 12.usdk is dead
      USDN: '0x0f9cb53ebe405d49a0bbdbd291a65ff571bc83e1', // 13.usdn
      // 14.linkusd is dead
      mUSD: '0x8474ddbe98f5aa3179b3b3f5942d724afcdec9f6', // 15.musd
      // 16.rsv is dead
      dUSD: '0x8038c01a0390a8c547446a0b2c18fc9aefecc10c', // 17.dusd
      tBTC: '0xc25099792e9349c7dd09759744ea681c7de2cb66', // 18.tbtc
      pBTC: '0x7f55dde206dbad629c080068923b36fe9d6bdbef', // 19.pbtc
      bBTC: '0x071c661b4deefb59e2a3ddb20db036821eee8f4b', // 20.bbtc
      oBTC: '0xd81da8d904b52208541bade1bd6595d8a251f8dd', // 21.obtc
      UST: '0x890f4e345b1daed0367a877a1612f86a1f86985f', // 22.ust
      eurs: '0x0ce6a5ff5217e38315f87032cf90686c96627caa', // 23.eurs
      seth: '0xc5424b857f758e906013f3555dad202e4bdb4567', // 24.seth
      aave: '0xdebf20617708857ebe4f679508e7b7863a8a8eee', // 25.aave
      steth: '0xdc24316b9ae028f1497c275eb9192a3ea0f67022', // 26.stETH
      saave: '0xeb16ae0052ed37f479f7fe63849198df1765a733', // saave
      ankreth: '0xa96a65c051bf88b4095ee1f2451c2a9d43f53ae2', // ankreth
      USDP: '0x42d7025938bec20b69cbae5a77421082407f053a', // usdp
      ib: '0x2dded6da1bf5dbdf597c45fcfaa3194e53ecfeaf', // iron bank
      link: '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0', // link
      btrflyweth: '0xf43b15ab692fde1f9c24a9fce700adcc809d5391', // redacted cartel
      // StableSwap "open pools" (crv.finance)
      TUSD: '0xecd5e75afb02efa118af914515d6521aabd189f1',
      STABLEx: '0x3252efd4ea2d6c78091a1f43982ee2c3659cc3d1',
      alUSD: '0x43b4fdfd4ff969587185cdb6f0bd875c5fc83f8c',
      FRAX: '0xd632f22692fac7611d2aa1c0d552930d43caed3b',
      LUSD: '0xed279fdd11ca84beef15af5d39bb4d4bee23f0ca',
      BUSD: '0x4807862aa8b2bf68830e4c8dc86d0e9a998e085a',
      DSU3CRV: '0x6ec80df362d7042c50d4469bcfbc174c9dd9109a',
      cvxcrv: '0x9d0464996170c6b9e75eed71c68b99ddedf279e8',
      mim: '0x5a6a4d54456819380173272a5e8e9b9904bdf41b',
      eurt: '0xfd5db7463a3ab53fd211b4af195c5bccc1a03890',
      ethcrv: '0x8301ae4fc9c624d1d396cbdaa1ed877821d7c511',
      ethcvx: '0xb576491f1e6e5e62f1d8f26062ee822b40b0e0d4',
      mimust: '0x55a8a39bc9694714e2874c1ce77aa1e599461e18',
      usttri_wormhole: '0xceaf7747579696a2f0bb206a14210e3c9e6fb269',
      fei_tri: '0x06cb22615ba53e60d67bf6c341a0fd5e718e1655',
      rai_tri: '0x618788357d0ebd8a37e763adab3bc575d54c2c7d',
      DOLA_tri: '0xaa5a67c256e27a5d80712c51971408db3370927d',
      OUSD_tri: '0x87650d7bbfc3a9f10587d7778206671719d9910d',
      d3pool: '0xbaaa1f5dba42c3389bdbc2c9d2de134f5cd0dc89',
      triEURpool: '0xb9446c4ef5ebe66268da6700d26f96273de3d571',
      ibEURsEUR: '0x19b080fe1ffa0553469d20ca36219f17fcf03859',
      wethyfi: '0xc26b89a667578ec7b3f11b2f98d6fd15c07c54ba',
}

export const MAINNET_CURVE_INFOS: Record<string, CurveInfo> = {
  DaiUsdc: {
    poolAddress: CURVE_POOLS.compound,
    tokens: [tokens.DAI, tokens.USDC],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // lending pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
    exchangeFunctionSelector: CurveFunctionSelectors.exchange_underlying,
  },
  DaiUsdcUsdtTusd: {
    poolAddress: CURVE_POOLS.TUSD,
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, TUSD],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // meta pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
    exchangeFunctionSelector: CurveFunctionSelectors.exchange_underlying,
  },
  DaiUsdcUsdtSusd: {
    poolAddress: CURVE_POOLS.sUSD,
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT, SUSD],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_underlying, // meta pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
    exchangeFunctionSelector: CurveFunctionSelectors.exchange_underlying,
  },
  TriPool: {
    poolAddress: CURVE_POOLS.TRI,
    tokens: [tokens.DAI, tokens.USDC, tokens.USDT],
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy, // base pool
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
    exchangeFunctionSelector: CurveFunctionSelectors.exchange,
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

export function getCurveV2InfosForPool(poolAddress: string): CurveInfo {
  const curveInfos = Object.values(CURVE_V2_MAINNET_INFOS).filter(
    c => c.poolAddress === poolAddress.toLowerCase()
  );
  invariant(curveInfos.length == 1, 'CurveInfo');
  return curveInfos[0];
}

export function getCurveLikeInfosForPool({
  poolAddress,
  protocol,
}: {
  poolAddress: string;
  protocol: Protocol;
}) {
  switch (protocol) {
    case Protocol.CurveV2: {
      return getCurveV2InfosForPool(poolAddress);
    }
    case Protocol.Curve: {
      return getCurveInfosForPool(poolAddress);
    }
    default:
      throw new Error(`unknown protocol: ${protocol}`);
  }
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
  [CURVE_V2_POOLS.cvxeth]: {
    tokens: [tokens.WETH, CRV],
    poolAddress: CURVE_V2_POOLS.cvxeth,
    exchangeFunctionSelector: CurveFunctionSelectors.exchange_v2,
    sellQuoteFunctionSelector: CurveFunctionSelectors.get_dy_v2,
    buyQuoteFunctionSelector: CurveFunctionSelectors.None,
  },
};
