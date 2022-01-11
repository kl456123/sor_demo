import { ethers, providers } from 'ethers';
import _ from 'lodash';

import { getAmountDistribution } from '../src/algorithm';
import { TOKENS } from '../src/base_token';
import { Pool, Route, Token, TokenAmount } from '../src/entities';
import { QuoteProvider } from '../src/quote-provider';
import { ChainId, Protocol, TradeType } from '../src/types';

// import { uniswapV3Protocols } from '../src/constants';

jest.setTimeout(20000);

describe('quote provider test', () => {
  const chainId = ChainId.MAINNET;
  const tokens = TOKENS[chainId]!;

  let quoteProvider: QuoteProvider;
  let provider: providers.BaseProvider;
  const routes: Route[] = [];
  const tokenAmounts: TokenAmount[] = [];
  let quoteToken: Token;
  let baseToken: Token;
  beforeAll(() => {
    provider = ethers.getDefaultProvider('mainnet');
    quoteProvider = new QuoteProvider(chainId, provider);

    // UNI->WETH->MATIC
    baseToken = tokens.UNI;
    quoteToken = tokens.MATIC;
    const hopTokenAmount = new TokenAmount(tokens.WETH, 0);
    const pool0 = new Pool([new TokenAmount(baseToken, 0), hopTokenAmount]);
    const pool1 = new Pool([hopTokenAmount, new TokenAmount(quoteToken, 0)]);

    _.forEach(
      [
        Protocol.UniswapV3_LOW,
        Protocol.UniswapV3_MEDIUM,
        Protocol.UniswapV3_HIGH,
      ],
      p => {
        const route = new Route([pool0, pool1], baseToken, quoteToken, p);
        routes.push(route);
      }
    );

    tokenAmounts.push(
      new TokenAmount(
        baseToken,
        ethers.utils.parseUnits('300000', baseToken.decimals)
      )
    );
  });

  test('quote for uniswapv3', async () => {
    const distributionPercent = 5;
    const [_percents, amounts] = getAmountDistribution(
      tokenAmounts[0],
      distributionPercent
    );
    const tradeType = TradeType.EXACT_INPUT;
    const routesQuotes = await quoteProvider.getQuotesForUniswapV3(
      amounts,
      routes,
      tradeType
    );

    expect(routesQuotes.length).toEqual(routes.length);
    _.forEach(routesQuotes, routeQuote => {
      _.forEach(routeQuote[1], ({ amount, quote }, index) => {
        expect(quote).toBeDefined();
        expect(amount.amount.eq(amounts[index].amount)).toBeTruthy();
      });
    });
  });

  test('quote for orderbook', async () => {
    const baseToken = tokens.WETH;
    const quoteToken = tokens.DAI;
    const limitOrderRoute = new Route(
      [
        new Pool([
          new TokenAmount(baseToken, 0),
          new TokenAmount(quoteToken, 0),
        ]),
      ],
      baseToken,
      quoteToken,
      Protocol.ZeroX
    );
    const tradeType = TradeType.EXACT_INPUT;
    const tokenAmounts = [
      new TokenAmount(
        baseToken,
        ethers.utils.parseUnits('3', baseToken.decimals)
      ),
    ];
    const routesQuotes = await quoteProvider.getQuoteForLimitOrder(
      tokenAmounts,
      limitOrderRoute,
      tradeType
    );
    routesQuotes;
  });
});
