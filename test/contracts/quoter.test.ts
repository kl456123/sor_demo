import { Interface } from '@ethersproject/abi';
import { BigNumber, BigNumberish, BytesLike, Signer, utils } from "ethers";
import { ethers } from 'hardhat';

import { DODOV2_FACTORIES_BY_CHAIN_ID } from '../../src/addresses';
import { ChainId } from '../../src/types';
import { IERC20 } from '../../typechain-types/IERC20';
import { Quoter } from '../../typechain-types/Quoter';
import { IERC20__factory } from '../../typechain-types/factories/IERC20__factory';
import { Quoter__factory } from '../../typechain-types/factories/Quoter__factory';

jest.setTimeout(100000);

type BatchSellSubcall = {
    id: BigNumberish;
    sellAmount: BigNumberish;
    data: BytesLike;
}

type MultiHopSellSubcall = {
    id: BigNumberish;
    data: BytesLike;
}


describe('Quoter', function () {
  let quoter: Quoter;
  let deployer: Signer;
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const UNISWAPRV2OUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const contractInterface: Interface = Quoter__factory.createInterface();
  beforeAll(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    const QuoterFactory = new Quoter__factory(deployer);
    quoter = await QuoterFactory.deploy();
    await quoter.deployed();
  });

  it('Test MultiplexMultiHopSell', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits("1000", 18));
    // encode batch calls
    // 100% to route uniswapv2
    const takerTokenAmount = sellAmount;
    const path = [WETH, USDC];
    const batchData = contractInterface.encodeFunctionData("quoteSellFromUniswapV2", [UNISWAPRV2OUTER, path, takerTokenAmount])
    const batchCalls: BatchSellSubcall[] = [{id:4, sellAmount, data: batchData}];
    // encode multihop calls
    const calls: MultiHopSellSubcall[] = [];
    const id = 2;
    const data = utils.defaultAbiCoder.encode(["tuple(uint8 id,uint256 sellAmount,bytes data)[]"], [batchCalls]);
    calls.push({id, data});
    const minBuyAmount = BigNumber.from(0);
    const buyAmount = await quoter.callStatic.multiplexMultiHopSellTokenForToken([inputToken.address, outputToken.address], calls, sellAmount, minBuyAmount);
    console.log(buyAmount.toString());
    expect(buyAmount.gt(0)).toBeTruthy;
  });

  it('Test MultiplexBatchSell', async () => {
    const inputToken: IERC20 = IERC20__factory.connect(WETH, deployer);
    const outputToken: IERC20 = IERC20__factory.connect(USDC, deployer);
    const sellAmount = BigNumber.from(utils.parseUnits("1000", 18));
    const calls: BatchSellSubcall[] = [];
    const percents = ["30","70"]
    {
        // uniswapv2
          const id = 4;
          const takerTokenAmount = sellAmount.mul(percents[0]).div(100);
          const path = [inputToken.address, outputToken.address];
          const data = contractInterface.encodeFunctionData("quoteSellFromUniswapV2", [UNISWAPRV2OUTER, path, takerTokenAmount])
          calls.push({id, sellAmount: takerTokenAmount, data});
      }
      {
          // dodov2
          const id = 4;
          const takerTokenAmount = sellAmount.mul(percents[1]).div(100);
          // dpp
          const registry = DODOV2_FACTORIES_BY_CHAIN_ID[ChainId.MAINNET]![0];
          const offset = 0;
          const data = contractInterface.encodeFunctionData("quoteSellFromDODOV2", [registry, offset, inputToken.address, outputToken.address, takerTokenAmount])
          calls.push({id, sellAmount: takerTokenAmount, data});
      }
      {
          // curvev1
          // const id = 4;
          // const takerTokenAmount = sellAmount.mul(percents[1]).div(100);
          // const curveInfo = {}
          // const data = contractInterface.encodeFunctionData("quoteSellFromCurve", [curveInfo, fromTokenIdx, toTokenIdx, takerTokenAmount])
          // calls.push({id, sellAmount: takerTokenAmount, data});
      }
      {
          // balancerv2
      }
    const minBuyAmount = BigNumber.from(0);
    const buyAmount  = await quoter.callStatic.multiplexBatchSellTokenForToken(
        inputToken.address, outputToken.address, calls, sellAmount, minBuyAmount
    );
    console.log(buyAmount.toString())
    expect(buyAmount.gt(0)).toBeTruthy;
  });
});
