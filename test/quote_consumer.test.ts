import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { TOKENS } from '../src/base_token';
import { DexAggregator } from '../src/dex_aggregator';
import { TokenAmount } from '../src/entities';
import { logger } from '../src/logging';
import { ChainId, TradeType } from '../src/types';
import {
  FillQuoteTransformer,
  IERC20,
  IERC20__factory,
  Swapper,
} from '../typechain-types';

import { loadFixture } from './utils/fixture';

jest.setTimeout(600000);
// disable logging during test
logger.level = 'fatal';

describe('QuoteConsumer Test', () => {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId];
  const WETH = tokens.WETH.address;
  const max = ethers.constants.MaxUint256;
  let dexAggregator: DexAggregator;
  // mainnet
  const provider = ethers.providers.getDefaultProvider('mainnet');
  // forknet
  const testProvider = ethers.provider;
  let deployer: Signer;
  let deployerAddr: string;
  let fillQuoteTransformer: FillQuoteTransformer;
  let swapper: Swapper;
  let transformerAddr: string;
  let swapperAddress: string;
  beforeAll(async () => {
    const fixture = await loadFixture(WETH);
    swapper = fixture.swapper;
    fillQuoteTransformer = fixture.fillQuoteTransformer;
    deployer = fixture.deployer;
    transformerAddr = fillQuoteTransformer.address;
    swapperAddress = swapper.address;
    deployerAddr = await deployer.getAddress();

    dexAggregator = new DexAggregator({
      chainId,
      nodeUrl: provider,
      testUrl: testProvider,
      transformerAddr,
    });
  });

  it('Simple Test', async () => {
    const baseToken = tokens.WETH;
    const quoteToken = tokens.USDC;
    const tradeType = TradeType.EXACT_INPUT;
    const amount = new TokenAmount(
      baseToken,
      ethers.utils.parseUnits('10000', baseToken.decimals)
    );

    const swapRouteOrNull = await dexAggregator.quote({
      amount,
      quoteToken,
      tradeType,
    });
    expect(swapRouteOrNull).toBeDefined();

    const inputToken: IERC20 = IERC20__factory.connect(
      baseToken.address,
      deployer
    );
    const outputToken: IERC20 = IERC20__factory.connect(
      quoteToken.address,
      deployer
    );
    // approve first
    await inputToken.approve(swapper.address, max);

    const before = await outputToken.balanceOf(deployerAddr);

    const swapRoute = swapRouteOrNull!;
    if (swapRoute.calldata) {
      await dexAggregator.swap(
        swapperAddress,
        swapRoute.calldata,
        deployerAddr
      );
    }
    const after = await outputToken.balanceOf(deployerAddr);
    const actualVal = after.sub(before);
    const expectVal = swapRoute.routeWithQuote.quote.amount;
    expect(actualVal.gt(0)).toBeTruthy();
    const error = actualVal.sub(expectVal).mul(10000).div(expectVal).abs();
    expect(error.lte(10)).toBeTruthy();
  });
});
