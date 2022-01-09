import { BigNumber } from 'ethers';

import { WETH9 } from './base_token';
import { PROTOCOLSTRMAP } from './constants';
import { RouteWithValidQuote, Token, TokenAmount } from './entities';
import { logger } from './logging';
import { IPoolProvider, PoolInfoByProtocol } from './pool_provider';
import { ChainId, Protocol } from './types';

const BASE_SWAP_COST = BigNumber.from(100000);

const COST_PER_EXTRA_HOP = BigNumber.from(20000);

export class GasModelFactory {
  public static async buildGasModel(
    chainId: ChainId,
    gasPriceWei: BigNumber,
    poolProvider: IPoolProvider,
    token: Token
  ) {
    // no need to convert from weth to token
    if (token.equals(WETH9[chainId]!)) {
      return {
        estimateGasCost: (routeWithValidQuote: RouteWithValidQuote) => {
          return GasModelFactory.estimateGas(
            routeWithValidQuote,
            gasPriceWei,
            chainId
          );
        },
      };
    }

    const ethPool = await GasModelFactory.getEthPool(
      chainId,
      token,
      poolProvider
    );

    return {
      estimateGasCost: (routeWithValidQuote: RouteWithValidQuote) => {
        const gasCostInEth = GasModelFactory.estimateGas(
          routeWithValidQuote,
          gasPriceWei,
          chainId
        );
        if (!ethPool) {
          return new TokenAmount(token, 0);
        }

        const ethToken0 = ethPool.token0.address == WETH9[chainId]!.address;
        const ethTokenPrice = ethToken0
          ? ethPool.tokens[1].divide(ethPool.tokens[0].amount)
          : ethPool.tokens[0].divide(ethPool.tokens[1].amount);
        const gasCostInTermsOfQuoteToken = ethTokenPrice.multiply(
          gasCostInEth.amount
        );
        return gasCostInTermsOfQuoteToken;
      },
    };
  }

  private static async getEthPool(
    chainId: ChainId,
    token: Token,
    poolProvider: IPoolProvider
  ) {
    // use pools from uniswapv2
    const weth = WETH9[chainId]!;
    const { poolAddress } = poolProvider.getPoolAddress(
      weth,
      token,
      Protocol.UniswapV2
    );
    const poolInfo: PoolInfoByProtocol = {
      protocol: PROTOCOLSTRMAP[Protocol.UniswapV2],
      address: poolAddress,
      tokens: [weth.address, token.address],
    };
    const poolAccessor = await poolProvider.getPool(
      [[weth, token]],
      [poolInfo]
    );
    const pool = poolAccessor.getPool(weth, token, Protocol.UniswapV2);
    if (!pool) {
      logger.error(
        `Could not find a WETH pool with ${token.symbol} to calculate gas costs`
      );
    }
    return pool;
  }

  // more hops, more gas usage
  public static estimateGas(
    routeWithValidQuote: RouteWithValidQuote,
    gasPriceWei: BigNumber,
    chainId: ChainId
  ) {
    const hops = routeWithValidQuote.route.pools.length;
    const gasUse = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1));
    const gasCostInEth = new TokenAmount(
      WETH9[chainId]!,
      gasUse.mul(gasPriceWei)
    );
    return gasCostInEth;
  }
}
