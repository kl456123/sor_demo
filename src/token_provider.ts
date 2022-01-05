import _ from 'lodash';

import { Token } from './entities';
import { logger } from './logging';
import { ChainId, ProviderConfig } from './types';

export interface ITokenProvider {
  getTokens(
    tokenAddresses: TokenInfo[],
    provider?: ProviderConfig
  ): Promise<TokenAccessor>;
}

export type TokenAccessor = {
  getTokenByAddress(address: string): Token | undefined;
  getTokenBySymbol(symbol: string): Token | undefined;
  getAllTokens: () => Token[];
};

export type TokenInfo = {
  address: string;
  symbol: string;
  decimals?: number;
};

const DEFAULT_DECIMALS = 18;
export class TokenProvider implements ITokenProvider {
  constructor(private chainId: ChainId) {}

  public async getTokens(
    tokensInfoRaw: TokenInfo[],
    providerConfig?: ProviderConfig
  ): Promise<TokenAccessor> {
    const addressToToken: { [address: string]: Token } = {};
    const symbolToToken: { [symbol: string]: Token } = {};

    // deduplicates
    const tokensInfo = _(tokensInfoRaw)
      .map(tokenInfoRaw => {
        return {
          ...tokenInfoRaw,
          address: tokenInfoRaw.address.toLowerCase(),
        };
      })
      .uniqBy(tokenInfoRaw => tokenInfoRaw.address)
      .value();

    if (tokensInfo.length > 0) {
      for (let i = 0; i < tokensInfo.length; ++i) {
        const address = tokensInfo[i].address;
        // use mock data here
        const symbol = tokensInfo[i].symbol;
        const decimals = tokensInfo[i].decimals ?? DEFAULT_DECIMALS;
        addressToToken[address] = new Token({
          chainId: this.chainId,
          address,
          decimals,
          symbol,
        });
        symbolToToken[symbol] = addressToToken[address]!;
      }

      logger.info(
        `Got token info from on-chain of blockNumber: ${
          providerConfig ? `${providerConfig.blockNumber}` : ''
        }`
      );
    }

    return {
      getTokenByAddress: (address: string): Token | undefined => {
        return addressToToken[address];
      },
      getTokenBySymbol: (symbol: string): Token | undefined => {
        return symbolToToken[symbol];
      },
      getAllTokens: (): Token[] => {
        return Object.values(addressToToken);
      },
    };
  }
}
