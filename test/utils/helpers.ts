import { BigNumberish } from 'ethers';
import { ethers, network } from 'hardhat';

// util functions
export async function impersonateAccounts(accounts: string[]) {
  for (const account of accounts) {
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    });
  }
}

export async function impersonateAndTransfer(
  amt: BigNumberish,
  token: { holder: string; contract: string },
  toAddr: string
) {
  const signer = await ethers.getSigner(token.holder);

  const contract = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
    token.contract,
    signer
  );

  await contract.transfer(toAddr, amt);
}
