// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const Sampler = await ethers.getContractFactory("ERC20BridgeSampler");
  const estimatedGas = await ethers.provider.estimateGas(Sampler.getDeployTransaction());
  const gasPrice = await ethers.provider.getGasPrice();
  const gasLimit = ethers.utils.formatEther(estimatedGas.mul(gasPrice));
  console.log(`estimateGas: ${estimatedGas}, gasPrice: ${gasPrice} gasLimit: ${gasLimit.toString()}`);
  const sampler = await Sampler.deploy();
  await sampler.deployed();
  console.log("Sampler deployed to:", sampler.address);

  // const Quoter = await ethers.getContractFactory("Quoter");
  // const quoter = await Quoter.deploy();
  // await quoter.deployed();
  // console.log("Quoter deployed to:", quoter.address);


  // deploy bridge adapter
  const BridgeAdapter = await ethers.getContractFactory('BridgeAdapter');
  const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';// different for diferent network
  const bridgeAdapter = await BridgeAdapter.deploy(weth);
  await bridgeAdapter.deployed();
  console.log(`BridgeAdapter deployed to: ${bridgeAdapter.address}`)

  // Swapper
  const Swapper = await ethers.getContractFactory('Swapper');
  const swapper = await Swapper.deploy();
  await swapper.deployed();
  console.log(`Swapper deployed to: ${swapper.address}`);

  // FillQuoteTransformer
  const FillQuoteTransformer = await ethers.getContractFactory('FillQuoteTransformer');
  const zeroX = ethers.constants.AddressZero;
  const fillQuoteTransformer = await FillQuoteTransformer.deploy(bridgeAdapter.address, zeroX);
  await fillQuoteTransformer.deployed();
  console.log(`FillQuoteTransformer deployed to: ${fillQuoteTransformer.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
