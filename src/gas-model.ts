import { BigNumber, providers } from 'ethers';

import { WETH9 } from './base_token';
import { Token, TokenAmount } from './entities';
import { MultiplexRoute } from './entitiesv2';
import { UniswapV2PoolData } from './markets/types';
import { RawPoolProvider } from './rawpool_provider';
import { ChainId, Protocol } from './types';
import { IUniswapV2Pair__factory } from './typechain';

const BASE_SWAP_COST = BigNumber.from(100000);

const COST_PER_EXTRA_HOP = BigNumber.from(20000);

export class GasModelFactory {
  constructor(
    protected readonly chainId: ChainId,
    protected readonly provider: providers.BaseProvider,
    protected readonly poolProvider: RawPoolProvider,
    protected readonly gasPriceWei: BigNumber
  ) {}

  public async buildGasModel(token: Token) {
    // no need to convert from weth to token
    if (token.equals(WETH9[this.chainId])) {
      return {
        estimateGasCost: (multiplexRoute: MultiplexRoute) => {
          return this.estimateGas(
            multiplexRoute,
            this.gasPriceWei,
            this.chainId
          );
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
          this.gasPriceWei,
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
    const rawPool = poolProvider.getPoolAddress(weth, token);
    if (!rawPool) {
      return {
        pool: null,
        reserve0: BigNumber.from(0),
        reserve1: BigNumber.from(0),
      };
    }

    const poolAccessor = poolProvider.getPools([rawPool], tokensMap);
    const pools = poolAccessor
      .getPool(weth, token)
      .filter(pool => pool.protocol === Protocol.UniswapV2);

    if (rawPool.poolData) {
      const poolData = rawPool.poolData as UniswapV2PoolData;
      return {
        pool: pools[0],
        reserve0: poolData.reserve0,
        reserve1: poolData.reserve1,
      };
    }

    // get eth price from uniswapv2
    const uniswapV2Pair = IUniswapV2Pair__factory.connect(
      rawPool.id,
      this.provider
    );
    const [reserve0, reserve1] = await uniswapV2Pair.getReserves();
    // cache reserve data
    rawPool.poolData = { reserve0, reserve1 } as UniswapV2PoolData;
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
