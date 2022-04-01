import { ethers, providers } from 'ethers';
import _ from 'lodash';

import { TOKENS } from '../src/base_token';
import { Pool, Route, Token, TokenAmount } from '../src/entities';
import { QuoterProvider } from '../src/quoter_provider';
import { RawPoolProvider } from '../src/rawpool_provider';
import { ChainId, Protocol } from '../src/types';

// import { uniswapV3Protocols } from '../src/constants';

jest.setTimeout(20000);

describe('quote provider test', () => {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId];

  let quoteProvider: QuoterProvider;
  const poolProvider = new RawPoolProvider(chainId);
  let provider: providers.BaseProvider;
  const routes: Route[] = [];
  const tokenAmounts: TokenAmount[] = [];
  let quoteToken: Token;
  let baseToken: Token;
  beforeAll(() => {
    provider = ethers.getDefaultProvider('mainnet');
    quoteProvider = new QuoterProvider(chainId, provider, poolProvider);

    // UNI->WETH->MATIC
    baseToken = tokens.UNI;
    quoteToken = tokens.MATIC;
    const hopTokenAmount = new TokenAmount(tokens.WETH, 0);
    const pool0 = new Pool([new TokenAmount(baseToken, 0), hopTokenAmount]);
    const pool1 = new Pool([hopTokenAmount, new TokenAmount(quoteToken, 0)]);

    _.forEach([Protocol.UniswapV3], p => {
      const route = new Route([pool0, pool1], baseToken, quoteToken, p);
      routes.push(route);
    });

    tokenAmounts.push(
      new TokenAmount(
        baseToken,
        ethers.utils.parseUnits('300000', baseToken.decimals)
      )
    );
  });

  test('quote for dex amm', async () => {
    quoteProvider;
  });
});
