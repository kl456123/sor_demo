import { BigNumber, BigNumberish, BytesLike, Signer, utils } from 'ethers';
import { ethers } from 'hardhat';

import { TOKENS } from '../../src/base_token';
import {
  encodeMultiplexMultiHop,
  getErc20BridgeSourceToBridgeSource,
  MultiHopSellSubcall,
  MultiplexSubcallType,
  OrderType,
  QuoteFromUniswapV2Params,
  QuoteFromUniswapV3Params,
  TransformData,
  TransformerParams,
  TransformerType,
} from '../../src/multiplex_encoder';
import { ChainId, Protocol, ProtocolId, TradeType } from '../../src/types';
import { UNISWAPV3_CONFIG_BY_CHAIN_ID } from '../../src/addresses';
import { getCurveInfosForTokens, getCurveInfosForPool } from '../../src/markets/curve';
import {
  BridgeAdapter,
  FillQuoteTransformer,
  IERC20,
  IERC20__factory,
  Swapper,
} from '../../typechain-types';
import { TOKEN_ADDR } from '../utils/constants';
import { impersonateAccounts, impersonateAndTransfer } from '../utils/helpers';

jest.setTimeout(100000);

type Order = {
  source: BytesLike;
  takerTokenAmount: BigNumberish;
  makerTokenAmount: BigNumberish;
  bridgeData: BytesLike;
};

describe('Swaper', function () {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId]!;
  const DAI = tokens.DAI.address;
  const USDC = tokens.USDC.address;
  const WETH = tokens.WETH.address;
  // const QUOTERV2_ADDRESS = '0x0209c4Dc18B2A1439fD2427E34E7cF3c6B91cFB9';
  const UNISWAPV2ROUTER =
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();
  const { quoter: QUOTERV2_ADDRESS, router:  UNISWAPV3ROUTER } = UNISWAPV3_CONFIG_BY_CHAIN_ID[chainId]!;
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
    await impersonateAndTransfer(utils.parseUnits('1000', 18), TOKEN_ADDR.DAI, deployerAddr);
    await impersonateAndTransfer(utils.parseUnits('1000', 6), TOKEN_ADDR.USDC, deployerAddr);
    await impersonateAndTransfer(
      utils.parseUnits('1', 18),
      TOKEN_ADDR.WETH,
      deployerAddr
    );
    await impersonateAndTransfer(utils.parseUnits('1000', 6), TOKEN_ADDR.USDT, deployerAddr);
  });

  it('MultiplexMultiHopSell Test', async () => {
    const sellAmount = BigNumber.from(utils.parseUnits('1', 18));
    const multiHopSubCalls: MultiHopSellSubcall[] = [];
    const max = ethers.constants.MaxUint256;

    {
        // uniswapv2
      const uniswapV2: QuoteFromUniswapV2Params = {
        protocol: Protocol.UniswapV2,
        router: UNISWAPV2ROUTER,
        path: [WETH, USDC],
      };
      const bridgeOrder = {
        source: getErc20BridgeSourceToBridgeSource(ProtocolId.UniswapV2),
        bridgeData: uniswapV2,
        takerTokenAmount: max,
        makerTokenAmount: 0,
      };
      const data: TransformData = {
        side: TradeType.EXACT_INPUT,
        sellToken: WETH,
        buyToken: USDC,
        orderType: OrderType.Bridge,
        bridgeOrder,
        fillAmount: max,
      };

      const transformations: TransformerParams[] = [];
      transformations.push({
        transformerType: TransformerType.FillQuoteTransformer,
        transformer: fillQuoteTransformer.address,
        transformData: data,
      });
      multiHopSubCalls.push({
        id: MultiplexSubcallType.BatchSell,
        data: {
          calls: [
            {
              id: MultiplexSubcallType.TransformERC20,
              sellAmount: max,
              data: transformations,
            },
          ],
        },
      });
    }

    {
        // uniswapv3
      const uniswapV3: QuoteFromUniswapV3Params = {
        protocol: Protocol.UniswapV3,
        quoter: UNISWAPV3ROUTER,// not quoter but router
        path: [USDC, DAI],
        fees: [100],
      };

      const bridgeOrder = {
        source: getErc20BridgeSourceToBridgeSource(ProtocolId.UniswapV3),
        bridgeData: uniswapV3,
        takerTokenAmount: max,//unlimited liquidity
        makerTokenAmount: 0,
      };
      const data: TransformData = {
        side: TradeType.EXACT_INPUT,
        sellToken: USDC,
        buyToken: DAI,
        orderType: OrderType.Bridge,
        bridgeOrder,
        fillAmount: max,
      };

      const transformations: TransformerParams[] = [];
      transformations.push({
        transformerType: TransformerType.FillQuoteTransformer,
        transformer: fillQuoteTransformer.address,
        transformData: data,
      });

      multiHopSubCalls.push({
        id: MultiplexSubcallType.BatchSell,
        data: {
          calls: [
            {
              id: MultiplexSubcallType.TransformERC20,
              sellAmount: max,
              data: transformations,
            },
          ]
        },
      });
    }
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

  it('MultiplexBatchSell Test', async () => {});

  it('UniswapV2 Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = utils.parseUnits('1', 18);
    const path = [inputToken.address, outputToken.address];
    const bridgeData = utils.defaultAbiCoder.encode(
      ['tuple(address router,address[] path)'],
      [{ router: UNISWAPV2ROUTER, path }]
    );
    const source = getErc20BridgeSourceToBridgeSource(ProtocolId.UniswapV2);
    const takerTokenAmount = 0;
    const makerTokenAmount = 0;
    const order: Order = {
      source,
      takerTokenAmount,
      makerTokenAmount,
      bridgeData,
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
    const fees = [100];
    const bridgeData = utils.defaultAbiCoder.encode(
      ['tuple(address router,address[] path,uint24[] fees)'],
      [{ router: UNISWAPV3ROUTER, path, fees }]
    );

    const source = getErc20BridgeSourceToBridgeSource(ProtocolId.UniswapV3);
    const takerTokenAmount = 0;
    const makerTokenAmount = 0;
    const order: Order = {
      source,
      takerTokenAmount,
      makerTokenAmount,
      bridgeData,
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

    it('CurveV1 Test', async ()=>{
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const curveInfos = getCurveInfosForTokens(
      inputToken.address,
      outputToken.address
    );

    const curveInfo = getCurveInfosForPool(curveInfos[0].poolAddress);
    const tokensAddress = curveInfo.tokens.map(token => token.address);
    const fromTokenIdx = tokensAddress.indexOf(inputToken.address);
    const toTokenIdx = tokensAddress.indexOf(outputToken.address);
    const params = {
      poolAddress: curveInfo.poolAddress,
      exchangeFunctionSelector: curveInfo.exchangeFunctionSelector,
      fromTokenIdx,
      toTokenIdx,
    };
    const bridgeData = utils.defaultAbiCoder.encode(
      [
        'tuple(address poolAddress,bytes4 exchangeFunctionSelector,uint256 fromTokenIdx,uint256 toTokenIdx)',
      ],
      [params]
    );

    const source = getErc20BridgeSourceToBridgeSource(ProtocolId.Curve);
    const takerTokenAmount = 0;
    const makerTokenAmount = 0;
    const order: Order = {
      source,
      takerTokenAmount,
      makerTokenAmount,
      bridgeData,
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
});
