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

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
