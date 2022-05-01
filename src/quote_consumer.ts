import { Interface } from '@ethersproject/abi';
import { BigNumber, ethers } from 'ethers';

import { Swapper__factory } from '../typechain-types';

import {
  BALANCER_V2_VAULT_ADDRESS_BY_CHAIN,
  BANCOR_REGISTRY_BY_CHAIN_ID,
  DODOV1_CONFIG_BY_CHAIN_ID,
  DODOV2_FACTORIES_BY_CHAIN_ID,
  KYBER_CONFIG_BY_CHAIN_ID,
  MAKER_PSM_INFO_BY_CHAIN_ID,
  uniswapV2RouterByChain,
  UNISWAPV3_CONFIG_BY_CHAIN_ID,
} from './addresses';
import {
  DirectSwapRoute,
  MultiplexRouteWithValidQuote,
  RouteType,
} from './entitiesv2';
import { UniswapV3PoolData } from './markets/types';
import {
  BatchSellSubcall,
  createTransformations,
  encodeMultiplexBatch,
  encodeMultiplexMultiHop,
  MultiHopSellSubcall,
  MultiplexSubcallType,
  QuoteParams,
} from './multiplex_encoder';
import { ChainId, Protocol } from './types';

export class QuoteConsumer {
  private readonly base = BigNumber.from(2).pow(255);
  private readonly percision = BigNumber.from(10).pow(18);
  protected swapperInterface: Interface;
  constructor(
    public readonly chainId: ChainId,
    public readonly provider: ethers.providers.BaseProvider,
    public readonly fillQuoteTransformerAddress: string
  ) {
    this.swapperInterface = Swapper__factory.createInterface();
  }

  private fillParams(route: DirectSwapRoute): QuoteParams {
    switch (route.pool.protocol) {
      case Protocol.UniswapV2: {
        return {
          protocol: route.pool.protocol,
          path: [route.input.address, route.output.address],
          router: uniswapV2RouterByChain[this.chainId],
        };
      }
      case Protocol.UniswapV3: {
        const { router } = UNISWAPV3_CONFIG_BY_CHAIN_ID[this.chainId];
        const poolData = route.pool.poolData as UniswapV3PoolData;
        return {
          protocol: route.pool.protocol,
          quoter: router,
          path: [route.input.address, route.output.address],
          fees: [poolData.feeTier],
        };
      }
      case Protocol.CurveV2:
      case Protocol.Curve: {
        return {
          protocol: route.pool.protocol,
          poolAddress: route.pool.id,
          fromToken: route.input.address,
          toToken: route.output.address,
        };
      }
      case Protocol.BalancerV2: {
        const vault = BALANCER_V2_VAULT_ADDRESS_BY_CHAIN[this.chainId];
        return {
          protocol: Protocol.BalancerV2,
          poolId: route.pool.id,
          vault,
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
      case Protocol.Balancer: {
        return {
          poolAddress: route.pool.id,
          makerToken: route.output.address,
          takerToken: route.input.address,
          protocol: Protocol.Balancer,
        };
      }
      case Protocol.DODO: {
        const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET];
        return {
          protocol: Protocol.DODO,
          registry: opts.registry,
          helper: opts.helper,
          takerToken: route.input.address,
          makerToken: route.output.address,
          pool: route.poolIds[0],
          isSellBase: route.input.address === route.pool.tokens[0].address,
        };
      }
      case Protocol.DODOV2: {
        const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET][0];
        const offset = 0;
        return {
          protocol: Protocol.DODOV2,
          registry,
          offset,
          takerToken: route.input.address,
          makerToken: route.output.address,
          pool: route.poolIds[0],
          isSellBase: route.input.address === route.pool.tokens[0].address,
        };
      }
      case Protocol.Kyber: {
        const opts = KYBER_CONFIG_BY_CHAIN_ID[this.chainId];
        return {
          protocol: Protocol.Kyber,
          reserveOffset: 0,
          hintHandler: opts.hintHandler,
          networkProxy: opts.networkProxy,
          weth: opts.weth,
          hint: '0x',
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
      case Protocol.Bancor: {
        const paths: string[][] = [[]];
        return {
          protocol: Protocol.Bancor,
          registry: BANCOR_REGISTRY_BY_CHAIN_ID[this.chainId],
          takerToken: route.input.address,
          makerToken: route.output.address,
          paths,
        };
      }
      case Protocol.MakerPSM: {
        const { psmAddress, gemTokenAddress, ilkIdentifier } =
          MAKER_PSM_INFO_BY_CHAIN_ID[this.chainId];
        return {
          protocol: Protocol.MakerPSM,
          psmAddress,
          ilkIdentifier,
          gemTokenAddress,
          takerToken: route.input.address,
          makerToken: route.output.address,
        };
      }
      case Protocol.ZeroX: {
        return {
          protocol: Protocol.ZeroX,
        };
      }
      default:
        throw new Error(
          `Unsupported fill params protocol: ${route.pool.protocol}`
        );
    }
  }

  public createMultiHopSellSubcall(
    routeWithQuote: MultiplexRouteWithValidQuote
  ): MultiHopSellSubcall[] {
    const encodedCalls: MultiHopSellSubcall[] = [];
    const routes = routeWithQuote.routesWithQuote;
    for (let i = 0; i < routes.length; ++i) {
      const encodedCall: MultiHopSellSubcall = {
        id: MultiplexSubcallType.BatchSell,
        data: { calls: this.createbatchSellSubcall(routes[i]) },
      };
      encodedCalls.push(encodedCall);
    }
    return encodedCalls;
  }

  public createbatchSellSubcall(
    routeWithQuote: MultiplexRouteWithValidQuote
  ): BatchSellSubcall[] {
    const encodedCalls: BatchSellSubcall[] = [];
    const routes = routeWithQuote.routesWithQuote;
    for (const route of routes) {
      const encodedCall: BatchSellSubcall = {
        id: MultiplexSubcallType.Invalid,
        sellAmount: BigNumber.from(route.percent)
          .mul(this.percision)
          .div(100)
          .add(this.base), //use percent in this batch
        data: [],
      };
      switch (route.routeType) {
        case RouteType.DIRECTSWAP: {
          encodedCall.id = MultiplexSubcallType.TransformERC20;
          const directSwapRoute = route.route as DirectSwapRoute;
          const param = this.fillParams(directSwapRoute);
          encodedCall.data = createTransformations(
            [directSwapRoute.input.address, directSwapRoute.output.address],
            param,
            this.fillQuoteTransformerAddress
          );
          break;
        }
        case RouteType.MULTI_HOP: {
          encodedCall.id = MultiplexSubcallType.MultiHopSell;
          const multihopcalls = this.createMultiHopSellSubcall(route);
          const tokens: string[] = route.routesWithQuote.map(
            routeWithQuote => routeWithQuote.amount.token.address
          );
          tokens.push(routeWithQuote.quote.token.address);
          encodedCall.data = { tokens, calls: multihopcalls };
          break;
        }
        default:
          throw new Error(
            `Unsupported MultiplexSubcallType: ${route.routeType}`
          );
      }
      encodedCalls.push(encodedCall);
    }
    return encodedCalls;
  }

  public createSubcallsFromRoute(routeWithQuote: MultiplexRouteWithValidQuote) {
    if (routeWithQuote.routeType === RouteType.BATCH) {
      return this.createbatchSellSubcall(routeWithQuote);
    }
    if (routeWithQuote.routeType === RouteType.MULTI_HOP) {
      return this.createMultiHopSellSubcall(routeWithQuote);
    }
    throw new Error(`unsupported routeType ${routeWithQuote.routeType}`);
  }

  public encodeBatchSellRoute(routeWithQuote: MultiplexRouteWithValidQuote) {
    if (routeWithQuote.routeType !== RouteType.BATCH) {
      throw new Error(`unsupported routeType ${routeWithQuote.routeType}`);
    }
    const subcalls = this.createbatchSellSubcall(routeWithQuote);
    const encodedSubcalls = encodeMultiplexBatch(subcalls);

    const takerToken = routeWithQuote.amount.token.address;
    const makerToken = routeWithQuote.quote.token.address;
    const sellAmount = routeWithQuote.amount.amount;
    const minBuyAmount = 0;
    // const minBuyAmount = routeWithQuote.quote.amount;
    return this.swapperInterface.encodeFunctionData(
      'multiplexBatchSellTokenForToken',
      [takerToken, makerToken, encodedSubcalls, sellAmount, minBuyAmount]
    );
  }

  public encodeMultiHopSellRoute(routeWithQuote: MultiplexRouteWithValidQuote) {
    if (routeWithQuote.routeType !== RouteType.MULTI_HOP) {
      throw new Error(`unsupported routeType ${routeWithQuote.routeType}`);
    }
    const subcalls = this.createMultiHopSellSubcall(routeWithQuote);

    const encodedSubcalls = encodeMultiplexMultiHop(subcalls);
    const tokens = routeWithQuote.routesWithQuote.map(
      routeWithQuote => routeWithQuote.amount.token.address
    );
    tokens.push(routeWithQuote.quote.token.address);
    const sellAmount = routeWithQuote.amount.amount;
    // const minBuyAmount = 0;
    const minBuyAmount = routeWithQuote.quote.amount;
    return this.swapperInterface.encodeFunctionData(
      'multiplexMultiHopSellTokenForToken',
      [tokens, encodedSubcalls, sellAmount, minBuyAmount]
    );
  }
}
