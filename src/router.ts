import { RoutingConfig, SwapConfig, SwapRoute, TradeType } from './types';
import { getBestSwapRoute } from './algorithm';

export abstract class IRouter {
  abstract route(
    amount: number,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRoute>;
}




export class AlphaRouter implements IRouter{
  public route(
    amount: number,
    tradeType: TradeType,
    swapConfig?: SwapConfig,
    partialRoutingConfig?: Partial<RoutingConfig>
  ): Promise<SwapRoute>{
    const swapRoute = getBestSwapRoute();
    return swapRoute;
  }
};
