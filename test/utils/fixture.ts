import { ethers } from 'hardhat';

import { TOKEN_ADDR } from './constants';
import { impersonateAccounts, impersonateAndTransfer } from './helpers';

export async function loadFixture(WETH: string) {
  const provider = ethers.provider;
  const blockNumber = await provider.getBlockNumber();
  // swapper
  const SwapperFactory = await ethers.getContractFactory('Swapper');
  const swapper = await SwapperFactory.deploy();
  await swapper.deployed();

  // bridge adapter
  const BridgeAdapter = await ethers.getContractFactory('BridgeAdapter');
  const bridgeAdapter = await BridgeAdapter.deploy(WETH);
  await bridgeAdapter.deployed();

  // fillQuote transformer
  const FillQuoteTransformer = await ethers.getContractFactory(
    'FillQuoteTransformer'
  );
  const zeroX = ethers.constants.AddressZero;
  const fillQuoteTransformer = await FillQuoteTransformer.deploy(
    bridgeAdapter.address,
    zeroX
  );
  await fillQuoteTransformer.deployed();

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const deployerAddr = await deployer.address;

  // fund address
  const holders = Object.values(TOKEN_ADDR).map(token => token.holder);
  await impersonateAccounts(holders);
  // deposit some tokens
  for (const holder of holders) {
    await deployer.sendTransaction({
      to: holder,
      value: ethers.utils.parseEther('100'),
    });
  }
  await impersonateAndTransfer(
    ethers.utils.parseUnits('10000', 18),
    TOKEN_ADDR.DAI,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('10000', 6),
    TOKEN_ADDR.USDC,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('10000', 18),
    TOKEN_ADDR.WETH,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('10000', 6),
    TOKEN_ADDR.USDT,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('100000', 18),
    TOKEN_ADDR.AAVE,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('1000000', 18),
    TOKEN_ADDR.UNI,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('100000000', 18),
    TOKEN_ADDR.MATIC,
    deployerAddr
  );
  await impersonateAndTransfer(
    ethers.utils.parseUnits('400', 18),
    TOKEN_ADDR.MATIC,
    deployerAddr
  );
  return {
    swapper,
    bridgeAdapter,
    fillQuoteTransformer,
    deployer,
    provider,
    blockNumber, // fork mainnet from this block
  };
}
