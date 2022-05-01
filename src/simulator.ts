import { BigNumber, BigNumberish } from 'ethers';
import hre from 'hardhat';

import { IERC20__factory } from '../typechain-types';

import { TOKENS } from './base_token';
import { ChainId } from './types';

const tokens = TOKENS[ChainId.MAINNET];

// wealthy address
export const BINANCE = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
export const BINANCE8 = '0xf977814e90da44bfa03b6295a0616a897441acec';
export const BINANCE7 = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';
export const MULTICHAIN = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';

// util functions
export async function impersonateAccount(account: string) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
  return hre.ethers.provider.getSigner(account);
}

export async function impersonateAndTransfer(
  amt: BigNumberish,
  token: { holder: string; contract: string },
  toAddr: string
) {
  const signer = await hre.ethers.getSigner(token.holder);

  await impersonateAccount(token.holder);
  if (token.contract.toLowerCase() === tokens.ETH.address.toLowerCase()) {
    // eth
    await signer.sendTransaction({ to: toAddr, value: BigNumber.from(amt) });
  } else {
    // erc20 token
    const contract = IERC20__factory.connect(token.contract, signer);
    await contract.transfer(toAddr, amt);
  }
}

export const wealthyAccounts: Record<
  string,
  { contract: string; holder: string }
> = {
  USDC: {
    contract: tokens.USDC.address,
    holder: BINANCE7,
  },
  WETH: {
    contract: tokens.WETH.address,
    holder: MULTICHAIN, // 137k weth
  },
  DAI: {
    contract: tokens.DAI.address,
    holder: BINANCE,
  },
  USDT: {
    contract: tokens.USDT.address,
    holder: BINANCE,
  },
  UNI: {
    contract: tokens.UNI.address,
    holder: BINANCE,
  },
  MATIC: {
    contract: tokens.MATIC.address,
    holder: BINANCE8,
  },
  AAVE: {
    contract: tokens.AAVE.address,
    holder: BINANCE,
  },
  YFI: {
    contract: tokens.YFI.address,
    holder: BINANCE,
  },
  ETH: {
    contract: tokens.ETH.address,
    holder: BINANCE7,
  },
};

export const provider = hre.ethers.provider;

export async function prepareTokens(
  walletAddress: string,
  tokenAddr: string,
  tokenAmount: string,
  ethValue: string
) {
  const accounts = Object.values(wealthyAccounts).filter(
    item => item.contract.toLowerCase() === tokenAddr.toLowerCase()
  );
  if (!accounts.length) {
    throw new Error(`trading from tokenAddr(${tokenAddr}) is not supported`);
  }
  if (BigNumber.from(ethValue).gt(0)) {
    await impersonateAndTransfer(ethValue, wealthyAccounts.ETH, walletAddress);
  }
  if (BigNumber.from(tokenAmount).gt(0)) {
    await impersonateAndTransfer(tokenAmount, accounts[0], walletAddress);
  }
}
