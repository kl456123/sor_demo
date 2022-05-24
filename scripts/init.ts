import { BigNumber, ethers } from 'ethers';

import { TOKENS } from '../src/base_token';
import { TokenAmount } from '../src/entities';
import { DirectSwapRoute, PoolV2 } from '../src/entitiesv2';
import { UniswapV3PoolData } from '../src/markets/types';
import { Sampler } from '../src/sampler';
import { ChainId, Protocol } from '../src/types';
import { IERC20__factory } from '../typechain-types/';

const provider = new ethers.providers.JsonRpcProvider(
  'http://35.75.165.133:8545'
);
// const provider = new ethers.providers.WebSocketProvider('ws://35.75.165.133:8546');
const infuraProvider = new ethers.providers.JsonRpcProvider(
  'https://mainnet.infura.io/v3/d9054056af514990a01542c57b706abe'
);
const alchemyProvider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.alchemyapi.io/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03'
);

async function main() {
  const blockNumber = await provider.getBlockNumber();
  console.log(blockNumber);
  const account = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';
  await provider.send('hardhat_impersonateAccount', [account]);
  const signer = provider.getSigner(account);
  const before = await provider.getBalance(account);
  console.log(before.toString());
  await signer.sendTransaction({
    to: ethers.constants.AddressZero,
    value: before.div(10),
  });
}

async function client() {
  const iface = IERC20__factory.createInterface();
  const weth = IERC20__factory.connect(
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    provider
  );
  const amount = ethers.utils.parseEther('1');
  const data = iface.encodeFunctionData('transfer', [
    ethers.constants.AddressZero,
    amount,
  ]);
  const slotValue = ethers.utils.hexZeroPad(amount.toHexString(), 32);
  const before = await weth.balanceOf(
    '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8'
  );
  console.log(before.toString());
  const overrides = {
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
      stateDiff: {
        '0x16cf7725acf62e1da3d149e873de4761e6b2b6d93dc469dcb9912ddbd2774bdd':
          slotValue,
      },
    },
  };
  const tx = {
    from: '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
    to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    data,
  };
  const time0 = Date.now();
  await provider.send('eth_call', [tx, 'latest', overrides]);
  const time1 = Date.now();
  console.log(`eth_call: ${time1 - time0}`);
}

async function testGetQuotes(
  sampler: Sampler,
  directSwapRoutes: DirectSwapRoute[],
  fillAmounts: BigNumber[],
  isSell: boolean
) {
  const samplerRoutes = directSwapRoutes.map(route => {
    return sampler.fillParams(route);
  });
  const op = isSell
    ? sampler.getSellQuotes(fillAmounts, samplerRoutes)
    : sampler.getBuyQuotes(fillAmounts, samplerRoutes);
  const time0 = Date.now();
  const [dexQuotes] = await sampler.executeAsync({}, op);
  const time1 = Date.now();
  console.log(
    `num amounts: ${fillAmounts.length}, num routes: ${
      samplerRoutes.length
    }, duration: ${time1 - time0}`
  );
}

async function testQuote() {
  const sampler = new Sampler(ChainId.MAINNET, provider, {});
  const tokens = TOKENS[ChainId.MAINNET];
  const amount = ethers.utils.parseUnits('2000', 6);
  const fillAmounts: BigNumber[] = [];
  for (let i = 0; i < 50; i++) {
    fillAmounts.push(amount.mul(i + 1));
  }
  const directSwapRoutes: DirectSwapRoute[] = [];
  const protocol = Protocol.UniswapV2;
  const tokensAmount = [
    new TokenAmount(tokens.USDC, 10),
    new TokenAmount(tokens.WETH, 10),
  ];
  const poolId = '0x';
  const pool = new PoolV2(tokensAmount, poolId, protocol);
  directSwapRoutes.push(new DirectSwapRoute(pool, tokens.USDC, tokens.WETH));

  {
    const tokensAmount = [
      new TokenAmount(tokens.WETH, 10),
      new TokenAmount(tokens.USDC, 10),
    ];
    const poolAddress = '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8';
    const protocol = Protocol.UniswapV3;
    const poolData = { feeTier: 3000 } as UniswapV3PoolData;
    const pool = new PoolV2(tokensAmount, poolAddress, protocol, poolData);
    directSwapRoutes.push(new DirectSwapRoute(pool, tokens.WETH, tokens.USDC));
  }

  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(testGetQuotes(sampler, directSwapRoutes, fillAmounts, true));
  }
  const time0 = Date.now();
  await Promise.all(promises);
  const time1 = Date.now();
  console.log(`total duration: ${time1 - time0}`);
  // await testGetQuotes(sampler, directSwapRoutes, fillAmounts, false);
}

testQuote().catch(console.error);
