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
  pool: string;
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
  protocol: Protocol.Curve | Protocol.CurveV2;
  poolAddress: string;
  fromToken: string;
  toToken: string;
};

export type SampleFromUniswapV3Params = {
  protocol: Protocol.UniswapV3;
  quoter: string;
  pool: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromDODOParams = {
  protocol: Protocol.DODO;
  helper: string;
  pool: string;
  takerToken: string;
  makerToken: string;
};

export type SampleFromDODOV2Params = {
  protocol: Protocol.DODOV2;
  pool: string;
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
