import { BigNumber, providers } from 'ethers';

import { WETH9 } from './base_token';
import { PROTOCOLSTRMAP } from './constants';
import { RouteWithValidQuote, Token, TokenAmount } from './entities';
import { logger } from './logging';
import { IPoolProvider, PoolInfoByProtocol } from './pool_provider';
import { ChainId, Protocol } from './types';
import { UniswapV2Pair__factory } from './types/v2';

const BASE_SWAP_COST = BigNumber.from(100000);

const COST_PER_EXTRA_HOP = BigNumber.from(20000);

export class GasModelFactory {
  constructor(protected readonly provider: providers.BaseProvider) {}

  public async buildGasModel(
    chainId: ChainId,
    gasPriceWei: BigNumber,
    poolProvider: IPoolProvider,
    token: Token
  ) {
    // no need to convert from weth to token
    if (token.equals(WETH9[chainId]!)) {
      return {
        estimateGasCost: (routeWithValidQuote: RouteWithValidQuote) => {
          return this.estimateGas(routeWithValidQuote, gasPriceWei, chainId);
        },
      };
    }

    const {
      pool: ethPool,
      token0Price,
      token1Price,
    } = await this.getEthPool(chainId, token, poolProvider);

    return {
      estimateGasCost: (routeWithValidQuote: RouteWithValidQuote) => {
        const gasCostInEth = this.estimateGas(
          routeWithValidQuote,
          gasPriceWei,
          chainId
        );
        if (!ethPool) {
          return new TokenAmount(token, 0);
        }

        const ethToken0 = ethPool.token0.address == WETH9[chainId]!.address;
        const ethTokenPrice = ethToken0 ? token0Price : token1Price;
        const gasCostInTermsOfQuoteToken = ethTokenPrice.mul(
          gasCostInEth.amount
        );
        return new TokenAmount(token, gasCostInTermsOfQuoteToken);
      },
    };
  }

  private async getEthPool(
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

    // get eth price from uniswapv2
    const uniswapV2Pair = UniswapV2Pair__factory.connect(
      poolAddress,
      this.provider
    );
    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    const token0Price = reserve1.div(reserve0);
    const token1Price = reserve0.div(reserve1);
    return { pool, token0Price, token1Price };
  }

  // more hops, more gas usage
  public estimateGas(
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
