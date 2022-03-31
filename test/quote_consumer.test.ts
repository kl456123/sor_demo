import { Signer, utils } from 'ethers';
import { ethers } from 'hardhat';

import { TOKENS } from '../src/base_token';
import { DexAggregator } from '../src/dex_aggregator';
import { TokenAmount } from '../src/entities';
import { ChainId, TradeType } from '../src/types';
import {
  BridgeAdapter,
  FillQuoteTransformer,
  IERC20,
  IERC20__factory,
  Swapper,
} from '../typechain-types';

import { TOKEN_ADDR } from './utils/constants';
import { loadFixture } from './utils/fixture';
import { impersonateAccounts, impersonateAndTransfer } from './utils/helpers';

jest.setTimeout(600000);

describe('QuoteConsumer Test', () => {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId]!;
  const DAI = tokens.DAI.address;
  const USDC = tokens.USDC.address;
  const WETH = tokens.WETH.address;
  const max = ethers.constants.MaxUint256;
  let dexAggregator: DexAggregator;
  // mainnet
  // const provider = ethers.providers.getDefaultProvider('mainnet');
  const provider = new ethers.providers.JsonRpcProvider({
    url: 'http://35.75.165.133:8545',
  });
  // forknet
  const testProvider = ethers.provider;
  let deployer: Signer;
  let deployerAddr: string;
  let bridgeAdapter: BridgeAdapter;
  let fillQuoteTransformer: FillQuoteTransformer;
  let swapper: Swapper;
  let transformerAddr: string;
  let swapperAddress: string;
  beforeAll(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();

    const fixture = await loadFixture(WETH);
    swapper = fixture.swapper;
    fillQuoteTransformer = fixture.fillQuoteTransformer;
    bridgeAdapter = fixture.bridgeAdapter;
    transformerAddr = fillQuoteTransformer.address;
    swapperAddress = swapper.address;

    dexAggregator = new DexAggregator({
      chainId,
      nodeUrl: provider,
      testUrl: testProvider,
      transformerAddr,
    });

    // fund address
    const holders = Object.values(TOKEN_ADDR).map(token => token.holder);
    await impersonateAccounts(holders);
    // deposit some tokens
    for (const holder of holders) {
      await deployer.sendTransaction({
        to: holder,
        value: ethers.utils.parseEther('1'),
      });
    }
    await impersonateAndTransfer(
      utils.parseUnits('10000', 18),
      TOKEN_ADDR.DAI,
      deployerAddr
    );
    await impersonateAndTransfer(
      utils.parseUnits('10000', 6),
      TOKEN_ADDR.USDC,
      deployerAddr
    );
    await impersonateAndTransfer(
      utils.parseUnits('10000', 18),
      TOKEN_ADDR.WETH,
      deployerAddr
    );
    await impersonateAndTransfer(
      utils.parseUnits('10000', 6),
      TOKEN_ADDR.USDT,
      deployerAddr
    );
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
    console.log('real: ', actualVal.toString());
    console.log('quote: ', expectVal.toString());
    const error = actualVal.sub(expectVal).mul(10000).div(expectVal);
    // ten thousand percent(0.0001%)
    console.log(`error: 0.00${error.toString()}%`);
  });
});
