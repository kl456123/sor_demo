import _ from 'lodash';
import { Token } from './entities';
import { logger } from './logging';
import { ChainId, ProviderConfig } from './types';

export interface ITokenProvider {
  getTokens(
    tokenAddresses: string[],
    provider?: ProviderConfig
  ): Promise<TokenAccessor>;
}

export type TokenAccessor = {
  getTokenByAddress(address: string): Token | undefined;
  getTokenBySymbol(symbol: string): Token | undefined;
  getAllTokens: () => Token[];
};

export class TokenProvider implements ITokenProvider {
  constructor(private chainId: ChainId) {}

  public async getTokens(
    tokenAddresses: string[],
    providerConfig?: ProviderConfig
  ): Promise<TokenAccessor> {
    const addressToToken: { [address: string]: Token } = {};
    const symbolToToken: { [symbol: string]: Token } = {};
    // deduplicates
    const addresses = _(tokenAddresses)
      .map(address => address.toLowerCase())
      .uniq()
      .value();
    if (addresses.length > 0) {
      for (let i = 0; i < addresses.length; ++i) {
        const address = addresses[i];
        // use mock data here
        const symbol = 'TOKEN';
        const decimals = 18;
        addressToToken[address] = new Token({
          chainId: this.chainId,
          address,
          decimals,
          symbol,
        });
        symbolToToken[symbol] = addressToToken[address]!;
      }

      logger.info(
        `Got token info from on-chain ${
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
