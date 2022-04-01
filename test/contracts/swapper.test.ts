import { BigNumber, BigNumberish, BytesLike, Signer, utils } from 'ethers';
import { ethers } from 'hardhat';

import { UNISWAPV3_CONFIG_BY_CHAIN_ID } from '../../src/addresses';
import { TOKENS } from '../../src/base_token';
import { getCurveInfosForTokens } from '../../src/markets/curve';
import {
  BatchSellSubcall,
  createBatchSellSubcalls,
  createBridgeOrder,
  createMultiHopSellSubcalls,
  encodeBridgeOrder,
  encodeMultiplexBatch,
  encodeMultiplexMultiHop,
  QuoteFromCurveParmas,
  QuoteFromUniswapV2Params,
  QuoteFromUniswapV3Params,
} from '../../src/multiplex_encoder';
import { ChainId, Protocol } from '../../src/types';
import {
  BridgeAdapter,
  FillQuoteTransformer,
  IERC20,
  IERC20__factory,
  Swapper,
} from '../../typechain-types';
import { TOKEN_ADDR } from '../utils/constants';
import { impersonateAccounts, impersonateAndTransfer } from '../utils/helpers';

jest.setTimeout(600000);

type Order = {
  source: BytesLike;
  takerTokenAmount: BigNumberish;
  makerTokenAmount: BigNumberish;
  bridgeData: BytesLike;
};

describe('Swaper', function () {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId];
  const DAI = tokens.DAI.address;
  const USDC = tokens.USDC.address;
  const WETH = tokens.WETH.address;
  const max = ethers.constants.MaxUint256;
  const UNISWAPV2ROUTER =
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();
  const { router: UNISWAPV3ROUTER } = UNISWAPV3_CONFIG_BY_CHAIN_ID[chainId];
  let deployerAddr: string;

  let swapper: Swapper;
  let bridgeAdapter: BridgeAdapter;
  let fillQuoteTransformer: FillQuoteTransformer;
  let deployer: Signer;
  beforeAll(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    // swapper
    const SwapperFactory = await ethers.getContractFactory('Swapper');
    swapper = await SwapperFactory.deploy();
    await swapper.deployed();

    // bridge adapter
    const BridgeAdapter = await ethers.getContractFactory('BridgeAdapter');
    bridgeAdapter = await BridgeAdapter.deploy(WETH);
    await bridgeAdapter.deployed();

    // fillQuote transformer
    const FillQuoteTransformer = await ethers.getContractFactory(
      'FillQuoteTransformer'
    );
    const zeroX = ethers.constants.AddressZero;
    fillQuoteTransformer = await FillQuoteTransformer.deploy(
      bridgeAdapter.address,
      zeroX
    );
    await fillQuoteTransformer.deployed();

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
      utils.parseUnits('10', 18),
      TOKEN_ADDR.WETH,
      deployerAddr
    );
    await impersonateAndTransfer(
      utils.parseUnits('10000', 6),
      TOKEN_ADDR.USDT,
      deployerAddr
    );
  });

  it('MultiplexMultiHopSell Test', async () => {
    const sellAmount = BigNumber.from(utils.parseUnits('1', 18));

    // uniswapv2
    const uniswapV2: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path: [WETH, USDC],
    };

    // uniswapv3
    const uniswapV3: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: UNISWAPV3ROUTER, // not quoter but router
      path: [USDC, DAI],
      fees: [100],
    };

    const multiHopSubCalls = createMultiHopSellSubcalls(
      [WETH, USDC, DAI],
      [uniswapV2, uniswapV3],
      fillQuoteTransformer.address
    );

    const calls = encodeMultiplexMultiHop(multiHopSubCalls);

    const minBuyAmount = BigNumber.from(0);

    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    // approve first
    await inputToken.approve(swapper.address, max);

    const before = await outputToken.balanceOf(deployerAddr);
    await swapper.multiplexMultiHopSellTokenForToken(
      [WETH, USDC, DAI],
      calls,
      sellAmount,
      minBuyAmount
    );
    const after = await outputToken.balanceOf(deployerAddr);
    expect(after.sub(before).gt(0)).toBeTruthy();
  });

  it.only('MultiplexBatchSell Test', async () => {
    const percents = [30, 30, 40];
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const takerToken = DAI;
    const makerToken = USDC;
    const inputToken: IERC20 = IERC20__factory.connect(takerToken, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(makerToken, deployer);
    // approve first
    await inputToken.approve(swapper.address, max);

    // uniswapv2
    const uniswapV2: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path: [takerToken, makerToken],
    };

    // uniswap3
    const uniswapV3: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: UNISWAPV3ROUTER,
      path: [takerToken, makerToken],
      fees: [100],
    };

    // curvev1
    const curveInfos = getCurveInfosForTokens(takerToken, makerToken);
    const curve: QuoteFromCurveParmas = {
      protocol: Protocol.Curve,
      poolAddress: curveInfos[0].poolAddress,
      fromToken: takerToken,
      toToken: makerToken,
    };

    const batchSellSubCalls: BatchSellSubcall[] = createBatchSellSubcalls(
      [takerToken, makerToken],
      [curve, uniswapV3, uniswapV2],
      fillQuoteTransformer.address,
      percents,
      sellAmount
    );

    const calls = encodeMultiplexBatch(batchSellSubCalls);
    const minBuyAmount = BigNumber.from(0);
    const before = await outputToken.balanceOf(deployerAddr);
    await swapper.multiplexBatchSellTokenForToken(
      takerToken,
      makerToken,
      calls,
      sellAmount,
      minBuyAmount
    );
    const after = await outputToken.balanceOf(deployerAddr);
    expect(after.sub(before).gt(0)).toBeTruthy();
  });

  it('MultiHop And Batch Test', async () => {
    // TODO add two-level distribution test
  });

  it('UniswapV2 Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = utils.parseUnits('1', 18);
    const path = [inputToken.address, outputToken.address];
    const orderParams: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path,
    };
    const bridgeOrder = createBridgeOrder(orderParams);
    const order: Order = {
      ...bridgeOrder,
      bridgeData: encodeBridgeOrder(bridgeOrder.bridgeData),
    };
    await inputToken.transfer(bridgeAdapter.address, sellAmount);
    const before = await outputToken.balanceOf(bridgeAdapter.address);
    await bridgeAdapter.trade(
      order,
      inputToken.address,
      outputToken.address,
      sellAmount
    );
    const after = await outputToken.balanceOf(bridgeAdapter.address);
    expect(after.sub(before).gt(0)).toBeTruthy();
  });

  it('UniswapV3 Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const path = [inputToken.address, outputToken.address];
    const orderParams: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: UNISWAPV3ROUTER, // not quoter but router
      path,
      fees: [100],
    };

    const bridgeOrder = createBridgeOrder(orderParams);
    const order: Order = {
      ...bridgeOrder,
      bridgeData: encodeBridgeOrder(bridgeOrder.bridgeData),
    };
    await inputToken.transfer(bridgeAdapter.address, sellAmount);
    const before = await outputToken.balanceOf(bridgeAdapter.address);
    await bridgeAdapter.trade(
      order,
      inputToken.address,
      outputToken.address,
      sellAmount
    );
    const after = await outputToken.balanceOf(bridgeAdapter.address);
    expect(after.sub(before).gt(0)).toBeTruthy();
  });

  it('CurveV1 Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const curveInfos = getCurveInfosForTokens(
      inputToken.address,
      outputToken.address
    );
    const orderParams: QuoteFromCurveParmas = {
      protocol: Protocol.Curve,
      poolAddress: curveInfos[0].poolAddress,
      fromToken: inputToken.address,
      toToken: outputToken.address,
    };
    const bridgeOrder = createBridgeOrder(orderParams);
    const order: Order = {
      ...bridgeOrder,
      bridgeData: encodeBridgeOrder(bridgeOrder.bridgeData),
    };
    await inputToken.transfer(bridgeAdapter.address, sellAmount);
    const before = await outputToken.balanceOf(bridgeAdapter.address);
    await bridgeAdapter.trade(
      order,
      inputToken.address,
      outputToken.address,
      sellAmount
    );
    const after = await outputToken.balanceOf(bridgeAdapter.address);
    expect(after.sub(before).gt(0)).toBeTruthy();
  });
  it('CurveV2 Test', async () => {
    expect;
  });
  it('BalanceV1 Test', async () => {
    expect;
  });

  it('BalanceV2 Test', async () => {
    expect;
  });

  it('DODO Test', async () => {
    expect;
  });
  it('DODOV2 Test', async () => {
    expect;
  });
  it('Bancor Test', async () => {
    expect;
  });
  it('Kyber Test', async () => {
    expect;
  });
  it('KyberDMM Test', async () => {
    expect;
  });
  it('MakerPSM Test', async () => {
    expect;
  });
});
