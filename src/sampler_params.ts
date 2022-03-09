import { BigNumberish, BytesLike } from 'ethers';

import { Protocol } from './types';

export type SampleParams =
  | SampleFromBalancerParams
  | SampleFromBalancerV2Params
  | SampleFromUniswapV3Params
  | SampleFromUniswapV2Params
  | SampleFromCurveParmas
  | SampleFromDODOParams
  | SampleFromBancorParams
  | SampleFromNativeOrderParams
  | SampleFromKyberParams
  | SampleFromMakerPSMParams
  | SampleFromDODOV2Params;

export type SampleFromBalancerV2Params = {
  protocol: Protocol.BalancerV2;
  poolId: BytesLike;
  vault: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromUniswapV2Params = {
  protocol: Protocol.UniswapV2;
  router: string;
  path: string[];
};

export type SampleFromCurveParmas = {
  protocol: Protocol.Curve;
  poolAddress: string;
  sellQuoteFunctionSelector: string;
  buyQuoteFunctionSelector: string;
  fromTokenIdx: number;
  toTokenIdx: number;
};

export type SampleFromUniswapV3Params = {
  protocol: Protocol.UniswapV3;
  quoter: string;
  path: string[];
  fees: BigNumberish[];
};

export type SampleFromDODOParams = {
  protocol: Protocol.DODO;
  registry: string;
  helper: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromDODOV2Params = {
  protocol: Protocol.DODOV2;
  registry: string;
  offset: BigNumberish;
  takerToken: string;
  makerToken: string;
};

export type SampleFromBalancerParams = {
  protocol: Protocol.Balancer;
  poolAddress: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromBancorParams = {
  protocol: Protocol.Bancor;
  registry: string;
  takerToken: string;
  makerToken: string;
  paths: string[][];
};

export type SampleFromNativeOrderParams = {
  protocol: Protocol.ZeroX;
};

export type SampleFromKyberParams = {
  protocol: Protocol.Kyber;
  reserveOffset: number;
  hintHandler: string;
  networkProxy: string;
  weth: string;
  hint: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromMakerPSMParams = {
  protocol: Protocol.MakerPSM;
  psmAddress: string;
  ilkIdentifier: string;
  gemTokenAddress: string;
  takerToken: string;
  makerToken: string;
};
