import { BigNumber, providers } from 'ethers';

import { WETH9 } from './base_token';
import { Token, TokenAmount } from './entities';
import { MultiplexRoute } from './entitiesv2';
import { logger } from './logging';
import { RawPoolProvider } from './rawpool_provider';
import { ChainId, Protocol, RawPool } from './types';
import { UniswapV2Pair__factory } from './types/v2';

const BASE_SWAP_COST = BigNumber.from(100000);

const COST_PER_EXTRA_HOP = BigNumber.from(20000);

export class GasModelFactory {
  constructor(
    protected readonly chainId: ChainId,
    protected readonly provider: providers.BaseProvider,
    protected readonly poolProvider: RawPoolProvider
  ) {}

  public async buildGasModel(gasPriceWei: BigNumber, token: Token) {
    // no need to convert from weth to token
    if (token.equals(WETH9[this.chainId])) {
      return {
        estimateGasCost: (multiplexRoute: MultiplexRoute) => {
          return this.estimateGas(multiplexRoute, gasPriceWei, this.chainId);
        },
      };
    }

    const {
      pool: ethPool,
      reserve0,
      reserve1,
    } = await this.getEthPool(this.chainId, token, this.poolProvider);

    return {
      estimateGasCost: (multiplexRoute: MultiplexRoute) => {
        const gasCostInEth = this.estimateGas(
          multiplexRoute,
          gasPriceWei,
          this.chainId
        );
        if (!ethPool) {
          return new TokenAmount(token, 0);
        }

        const ethToken0 = ethPool.token0.address == WETH9[this.chainId].address;
        // const ethTokenPrice = ethToken0 ? token0Price : token1Price;
        const gasCostInTermsOfQuoteToken = ethToken0
          ? reserve1.mul(gasCostInEth.amount).div(reserve0)
          : reserve0.mul(gasCostInEth.amount).div(reserve1);
        return new TokenAmount(token, gasCostInTermsOfQuoteToken);
      },
    };
  }

  private async getEthPool(
    chainId: ChainId,
    token: Token,
    poolProvider: RawPoolProvider
  ) {
    // use pools from uniswapv2
    const weth = WETH9[chainId];
    const tokensMap: Record<string, Token> = {};
    tokensMap[weth.address] = weth;
    tokensMap[token.address] = token;
    const poolAddresses = poolProvider.getPoolAddress(weth, token);
    if (!poolAddresses.length) {
      logger.error(
        `Could not find a WETH pool with ${token.symbol} to calculate gas costs`
      );
    }
    const rawPool: RawPool = {
      protocol: Protocol.UniswapV2,
      id: poolAddresses[0],
      tokens: [
        { address: weth.address, symbol: weth.symbol! },
        { address: token.address, symbol: token.symbol! },
      ],
      reserve: 10,
    };

    const poolAccessor = poolProvider.getPools([rawPool], tokensMap);
    const pools = poolAccessor
      .getPool(weth, token)
      .filter(pool => pool.protocol === Protocol.UniswapV2);

    const poolAddress = pools[0].id;
    // get eth price from uniswapv2
    const uniswapV2Pair = UniswapV2Pair__factory.connect(
      poolAddress,
      this.provider
    );
    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    return { pool: pools[0], reserve0, reserve1 };
  }

  // more hops, more gas usage
  public estimateGas(
    multiplexRoute: MultiplexRoute,
    gasPriceWei: BigNumber,
    chainId: ChainId
  ) {
    const hops = multiplexRoute.poolIds.length;
    const gasUse = BASE_SWAP_COST.add(COST_PER_EXTRA_HOP.mul(hops - 1));
    const gasCostInEth = new TokenAmount(
      WETH9[chainId],
      gasUse.mul(gasPriceWei)
    );
    return gasCostInEth;
  }
}
