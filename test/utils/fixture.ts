import { ethers } from 'hardhat';

export async function loadFixture(WETH: string) {
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
  return { swapper, bridgeAdapter, fillQuoteTransformer };
}
