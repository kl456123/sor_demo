import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { TOKENS } from '../../src/base_token';
import { ChainId } from '../../src/types';
import {
  ERC20BridgeSampler,
  ERC20BridgeSampler__factory,
} from '../../typechain-types';

jest.setTimeout(10000);

describe('test sampler contract', () => {
  let deployer: Signer;
  let sampler: ERC20BridgeSampler;
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId];
  beforeAll(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    const SamplerFactory = new ERC20BridgeSampler__factory(deployer);
    sampler = await SamplerFactory.deploy();
    await sampler.deployed();
  });

  it('test uniswapv3 sampler', async () => {
    const takerTokenAmounts = [
      '2000000000000000000',
      '4000000000000000000',
      '8000000000000000000',
    ];
    const takerToken = tokens.WETH.address;
    const makerToken = tokens.USDC.address;
    const quoter = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
    const pool = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
    const makerTokenAmounts = await sampler.callStatic.sampleSellsFromUniswapV3(
      { quoter, pool },
      takerToken,
      makerToken,
      takerTokenAmounts
    );
    console.log(makerTokenAmounts.map(amount => amount.toString()));
  });

  it('test uniswapv2 sampler', async () => {});
});
