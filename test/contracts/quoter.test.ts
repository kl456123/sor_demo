import { BigNumber, BytesLike, Signer, utils } from 'ethers';
import { ethers } from 'hardhat';

import {
  BALANCER_V2_VAULT_ADDRESS_BY_CHAIN,
  DODOV1_CONFIG_BY_CHAIN_ID,
  DODOV2_FACTORIES_BY_CHAIN_ID,
} from '../../src/addresses';
import {
  getCurveInfosForPool,
  getCurveInfosForTokens,
} from '../../src/markets/curve';
import {
  BatchSellSubcall,
  EncodedBatchSellSubcall,
  encodeMultiplexBatch,
  encodeMultiplexMultiHop,
  MultiHopSellParams,
  MultiHopSellSubcall,
  MultiplexSubcallType,
  QuoteFromBalancerV2Params,
  QuoteFromCurveParmas,
  QuoteFromUniswapV2Params,
  QuoteFromUniswapV3Params,
  QuoteParams,
} from '../../src/multiplex_encoder';
import { ChainId, Protocol } from '../../src/types';
import { IERC20 } from '../../typechain-types/IERC20';
import { Quoter } from '../../typechain-types/Quoter';
import { ICurve__factory } from '../../typechain-types/factories/ICurve__factory';
import { IERC20__factory } from '../../typechain-types/factories/IERC20__factory';
import { Quoter__factory } from '../../typechain-types/factories/Quoter__factory';

jest.setTimeout(100000);

describe('Quoter', function () {
  let quoter: Quoter;
  let deployer: Signer;
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase();
  const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
  const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase();
  const QUOTERV2_ADDRESS = '0x0209c4Dc18B2A1439fD2427E34E7cF3c6B91cFB9';
  const UNISWAPV2ROUTER =
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();
  beforeAll(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    const QuoterFactory = new Quoter__factory(deployer);
    quoter = await QuoterFactory.deploy();
    await quoter.deployed();
  });

  it('MultiplexMultiHopSell Test', async () => {
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const multiHopSubCalls: MultiHopSellSubcall[] = [];
    const max = ethers.constants.MaxUint256;
    const uniswapV2: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path: [WETH, USDC],
    };
    const uniswapV3: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: QUOTERV2_ADDRESS,
      path: [USDC, DAI],
      fees: [100],
    };
    multiHopSubCalls.push({
      id: MultiplexSubcallType.BatchSell,
      data: {
        calls: [
          { id: MultiplexSubcallType.Quoter, sellAmount: max, data: uniswapV2 },
        ],
        recipient: '0x0',
      },
    });
    multiHopSubCalls.push({
      id: MultiplexSubcallType.BatchSell,
      data: {
        calls: [
          { id: MultiplexSubcallType.Quoter, sellAmount: max, data: uniswapV3 },
        ],
        recipient: '0x0',
      },
    });
    const calls = encodeMultiplexMultiHop(multiHopSubCalls);

    const minBuyAmount = BigNumber.from(0);
    const buyAmount =
      await quoter.callStatic.multiplexMultiHopSellTokenForToken(
        [WETH, USDC, DAI],
        calls,
        sellAmount,
        minBuyAmount
      );
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('MultiplexBatchSell Test', async () => {
    const percents = ['30', '20', '10', '40'];
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const takerToken = DAI;
    const makerToken = USDC;

    // uniswapv2
    const uniswapV2: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path: [takerToken, makerToken],
    };

    // uniswap3
    const uniswapV3: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: QUOTERV2_ADDRESS,
      path: [takerToken, makerToken],
      fees: [100],
    };

    // curvev1
    const curveInfos = getCurveInfosForTokens(DAI, USDC);
    const curve: QuoteFromCurveParmas = {
      protocol: Protocol.Curve,
      poolAddress: curveInfos[0].poolAddress,
      fromToken: takerToken,
      toToken: makerToken,
    };

    // balancerV2
    const poolId =
      '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063';
    const vault = BALANCER_V2_VAULT_ADDRESS_BY_CHAIN[ChainId.MAINNET]!;
    const balancerV2: QuoteFromBalancerV2Params = {
      protocol: Protocol.BalancerV2,
      poolId,
      vault,
      takerToken: DAI,
      makerToken: USDC,
    };

    const batchSellSubCalls: BatchSellSubcall[] = [];
    const quoteParams: QuoteParams[] = [
      balancerV2,
      curve,
      uniswapV3,
      uniswapV2,
    ];

    for (let i = 0; i < quoteParams.length; ++i) {
      batchSellSubCalls.push({
        id: MultiplexSubcallType.Quoter,
        sellAmount: sellAmount.mul(percents[i]).div(100),
        // use quote directly or multihop for more complex route
        data: quoteParams[i],
      });
    }
    const calls: EncodedBatchSellSubcall[] =
      encodeMultiplexBatch(batchSellSubCalls);
    const minBuyAmount = BigNumber.from(0);
    const buyAmount = await quoter.callStatic.multiplexBatchSellTokenForToken(
      takerToken,
      makerToken,
      calls,
      sellAmount,
      minBuyAmount
    );
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('MultiHop And Batch Test', async () => {
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const multiHopSubCalls: MultiHopSellSubcall[] = [];
    const batchSellSubCalls: BatchSellSubcall[] = [];
    const max = ethers.constants.MaxUint256;
    const takerToken = DAI;
    const makerToken = USDC;
    const hopToken = WETH;

    /////////////////////////////////
    // multihop
    const uniswapV2: QuoteFromUniswapV2Params = {
      protocol: Protocol.UniswapV2,
      router: UNISWAPV2ROUTER,
      path: [takerToken, hopToken],
    };
    const uniswapV3: QuoteFromUniswapV3Params = {
      protocol: Protocol.UniswapV3,
      quoter: QUOTERV2_ADDRESS,
      path: [hopToken, makerToken],
      fees: [100],
    };
    multiHopSubCalls.push({
      id: MultiplexSubcallType.BatchSell,
      data: {
        calls: [
          { id: MultiplexSubcallType.Quoter, sellAmount: max, data: uniswapV2 },
        ],
        recipient: '0x0',
      },
    });
    multiHopSubCalls.push({
      id: MultiplexSubcallType.BatchSell,
      data: {
        calls: [
          { id: MultiplexSubcallType.Quoter, sellAmount: max, data: uniswapV3 },
        ],
        recipient: '0x0',
      },
    });

    // balancerV2
    const poolId =
      '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063';
    const vault = BALANCER_V2_VAULT_ADDRESS_BY_CHAIN[ChainId.MAINNET]!;
    const balancerV2: QuoteFromBalancerV2Params = {
      protocol: Protocol.BalancerV2,
      poolId,
      vault,
      takerToken,
      makerToken,
    };
    const percents = ['30', '70'];
    const params: (QuoteParams | MultiHopSellParams)[] = [
      balancerV2,
      {
        tokens: [takerToken, hopToken, makerToken],
        calls: multiHopSubCalls,
        recipient: '0x0',
      },
    ];
    const ids = [
      MultiplexSubcallType.Quoter,
      MultiplexSubcallType.MultiHopSell,
    ];

    for (let i = 0; i < params.length; ++i) {
      batchSellSubCalls.push({
        id: ids[i],
        sellAmount: sellAmount.mul(percents[i]).div(100),
        // use quote directly or multihop for more complex route
        data: params[i],
      });
    }
    const calls: EncodedBatchSellSubcall[] =
      encodeMultiplexBatch(batchSellSubCalls);
    const minBuyAmount = BigNumber.from(0);
    const buyAmount = await quoter.callStatic.multiplexBatchSellTokenForToken(
      takerToken,
      makerToken,
      calls,
      sellAmount,
      minBuyAmount
    );
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('UniswapV3Quoter Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const QUOTERV2_ADDRESS = '0x0209c4Dc18B2A1439fD2427E34E7cF3c6B91cFB9';
    const path = [inputToken.address, outputToken.address];
    const fees = [100];
    const isValidFee = await quoter.isValidFee(
      QUOTERV2_ADDRESS,
      inputToken.address,
      outputToken.address,
      fees[0]
    );
    expect(isValidFee).toBeTruthy();
    const data = utils.defaultAbiCoder.encode(
      ['tuple(address quoter,address[] path,uint24[] fees)'],
      [{ quoter: QUOTERV2_ADDRESS, path, fees }]
    );
    const buyAmount = await quoter.callStatic.quoteSellFromUniswapV3(
      sellAmount,
      data
    );
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('DODOV1Quoter Test', async () => {
    // dodov1
    const inputToken: IERC20 = IERC20__factory.connect(USDT, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 6));
    const opts = DODOV1_CONFIG_BY_CHAIN_ID[ChainId.MAINNET]!;
    const data = utils.defaultAbiCoder.encode(
      [
        'tuple(address registry,address helper,address takerToken,address makerToken)',
      ],
      [
        {
          registry: opts.registry,
          helper: opts.helper,
          takerToken: inputToken.address,
          makerToken: outputToken.address,
        },
      ]
    );
    const { makerTokenAmount: buyAmount } =
      await quoter.callStatic.quoteSellFromDODO(sellAmount, data);
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it.skip('DODOV2Quoter Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('10', 18));
    // dpp
    const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET]![0];
    const offset = 0;
    const data = utils.defaultAbiCoder.encode(
      [
        'tuple(address registry,uint256 offset,address takerToken,address makerToken)',
      ],
      [
        {
          registry: registry,
          offset,
          takerToken: inputToken.address,
          makerToken: outputToken.address,
        },
      ]
    );
    const { makerTokenAmount: buyAmount } =
      await quoter.callStatic.quoteSellFromDODOV2(sellAmount, data);
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('BalancerV2Quoter Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const poolId =
      '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063';
    const vault = BALANCER_V2_VAULT_ADDRESS_BY_CHAIN[ChainId.MAINNET]!;
    type QuoteFromBalancerV2Params = {
      poolId: BytesLike;
      vault: string;
      takerToken: string;
      makerToken: string;
    };
    const params: QuoteFromBalancerV2Params = {
      poolId,
      vault,
      takerToken: inputToken.address,
      makerToken: outputToken.address,
    };
    const data = utils.defaultAbiCoder.encode(
      [
        'tuple(bytes32 poolId,address vault,address takerToken,address makerToken)',
      ],
      [params]
    );
    const buyAmount = await quoter.callStatic.quoteSellFromBalancerV2(
      sellAmount,
      data
    );
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('CurveQuoter Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const curveInfos = getCurveInfosForTokens(
      inputToken.address,
      outputToken.address
    );
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const curveInfo = getCurveInfosForPool(curveInfos[0].poolAddress);
    const tokensAddress = curveInfo.tokens.map(token => token.address);
    const fromTokenIdx = tokensAddress.indexOf(inputToken.address);
    const toTokenIdx = tokensAddress.indexOf(outputToken.address);
    const curveInterface = ICurve__factory.createInterface();
    const params = {
      poolAddress: curveInfo.poolAddress,
      sellQuoteFunctionSelector: curveInterface.getSighash('get_dy_underlying'),
      buyQuoteFunctionSelector: '0x00000000',
      fromTokenIdx,
      toTokenIdx,
    };
    const data = utils.defaultAbiCoder.encode(
      [
        'tuple(address poolAddress,bytes4 sellQuoteFunctionSelector,bytes4 buyQuoteFunctionSelector,uint256 fromTokenIdx,uint256 toTokenIdx)',
      ],
      [params]
    );
    const buyAmount = await quoter.quoteSellFromCurve(sellAmount, data);
    expect(buyAmount.gt(0)).toBeTruthy();
  });

  it('UniswapV2Quoter Test', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(DAI, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits('1000', 18));
    const path = [inputToken.address, outputToken.address];
    const data = utils.defaultAbiCoder.encode(
      ['tuple(address router,address[] path)'],
      [{ router: UNISWAPV2ROUTER, path }]
    );
    const buyAmount = await quoter.quoteSellFromUniswapV2(sellAmount, data);
    expect(buyAmount.gt(0)).toBeTruthy();
  });
});
