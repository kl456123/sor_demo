import { ethers } from 'ethers';

import { SubgraphPoolProvider } from './subgraph_provider';
import { ChainId, ProviderConfig } from './types';

// async function quote(tokenIn: Token, tokenOut: Token) {
// tokenIn;
// tokenOut;
// }

// async function swap(tokenIn: Token, tokenOut: Token) {
// tokenIn;
// tokenOut;
// }

async function main() {
  const provider = ethers.getDefaultProvider('mainnet');
  const curBlockNumber = await provider.getBlockNumber();
  const delay = 10;
  const blockNumber = curBlockNumber - delay;
  const subgraphPoolProvider = new SubgraphPoolProvider(ChainId.MAINNET);
  const providerConfig: ProviderConfig = { blockNumber };

  const now = Date.now();
  const rawPools = await subgraphPoolProvider.getPools(
    undefined,
    undefined,
    providerConfig
  );

  const deltaTime = Date.now() - now;
  console.log(deltaTime);
  console.log(rawPools.length);
}

main().catch(console.error);
