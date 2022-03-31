import { Protocol, ProtocolId, RoutingConfig } from './types';

export const DEFAULT_ROUTER_CONFIG: RoutingConfig = {
  poolSelections: {
    topN: 10,
    topNSecondHop: 6,
    topNTokenInOut: 8,

    topNDirectSwaps: 1,
    topNWithEachBaseToken: 2,
    topNWithBaseToken: 5,
    topNWithBaseTokenInSet: false,
  },
  maxSwapsPerPath: 3,
  minSplits: 1,
  maxSplits: 5,
  firstDistributionPercent: 10,
  secondDistributionPercent: 2,
  includedSources: [],
  excludedSources: [],
};

// TODO (change hardcode style)
export const PROTOCOLSTRMAP: { [name: string]: Protocol } = {
  UniswapV2: Protocol.UniswapV2,
  SushiSwap: Protocol.SushiSwap,
  Eth2Dai: Protocol.Eth2Dai,
  ZeroX: Protocol.ZeroX,
  Curve: Protocol.Curve,
  CurveV2: Protocol.CurveV2,
  UniswapV3: Protocol.UniswapV3,
  BalancerV2: Protocol.BalancerV2,
  DODOV2: Protocol.DODOV2,
  DODO: Protocol.DODO,
  Bancor: Protocol.Bancor,
  Balancer: Protocol.Balancer,
  KyberDMM: Protocol.KyberDMM,
  MakerPSM: Protocol.MakerPSM,
};

export const Protocol2Id = {
  UniswapV2: ProtocolId.UniswapV2,
  SushiSwap: ProtocolId.SushiSwap,
  Eth2Dai: ProtocolId.Eth2Dai,
  ZeroX: ProtocolId.ZeroX,
  Curve: ProtocolId.Curve,
  CurveV2: ProtocolId.CurveV2,
  UniswapV3: ProtocolId.UniswapV3,
  BalancerV2: ProtocolId.BalancerV2,
  DODOV2: ProtocolId.DODOV2,
  DODO: ProtocolId.DODO,
  Bancor: ProtocolId.Bancor,
  Balancer: ProtocolId.Balancer,
  Kyber: ProtocolId.Kyber,
  KyberDMM: ProtocolId.KyberDMM,
  MakerPSM: ProtocolId.MakerPSM,
};
