// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2021 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IDODOV2Registry {
    function getDODOPool(address baseToken, address quoteToken)
        external
        view
        returns (address[] memory machines);
}

interface IDODOV2Pool {
    function querySellBase(address trader, uint256 payBaseAmount)
        external
        view
        returns (uint256 receiveQuoteAmount, uint256 mtFee);

    function querySellQuote(address trader, uint256 payQuoteAmount)
        external
        view
        returns (uint256 receiveBaseAmount, uint256 mtFee);

    function _BASE_TOKEN_() external view returns (address);

    function _QUOTE_TOKEN_() external view returns (address);
}

contract DODOV2Sampler {
    /// @dev Gas limit for DODO V2 calls.
    uint256 private constant DODO_V2_CALL_GAS = 300e3; // 300k
    struct DODOV2SamplerOpts {
        address pool;
    }

    /// @dev Sample sell quotes from DODO V2.
    /// @param opts dodov2 sampler options.
    /// @param takerTokenAmounts Taker token sell amount for each sample.
    /// @return makerTokenAmounts Maker amounts bought at each taker token
    ///         amount.
    function sampleSellsFromDODOV2(
        DODOV2SamplerOpts memory opts,
        address takerToken,
        address makerToken,
        uint256[] memory takerTokenAmounts
    ) public view returns (uint256[] memory makerTokenAmounts) {
        uint256 numSamples = takerTokenAmounts.length;
        makerTokenAmounts = new uint256[](numSamples);

        bool sellBase;
        if (IDODOV2Pool(opts.pool)._BASE_TOKEN_() == takerToken) {
            require(
                IDODOV2Pool(opts.pool)._QUOTE_TOKEN_() == makerToken,
                'trade condition check failed'
            );
            sellBase = true;
        } else {
            require(
                IDODOV2Pool(opts.pool)._QUOTE_TOKEN_() == takerToken,
                'trade condition check failed'
            );
            require(
                IDODOV2Pool(opts.pool)._BASE_TOKEN_() == makerToken,
                'trade condition check failed'
            );
            sellBase = false;
        }

        for (uint256 i = 0; i < numSamples; i++) {
            if (sellBase) {
                try
                    IDODOV2Pool(opts.pool).querySellBase{gas: DODO_V2_CALL_GAS}(
                        address(0),
                        takerTokenAmounts[i]
                    )
                returns (uint256 amount, uint256) {
                    makerTokenAmounts[i] = amount;
                } catch (bytes memory) {}
            } else {
                try
                    IDODOV2Pool(opts.pool).querySellQuote{
                        gas: DODO_V2_CALL_GAS
                    }(address(0), takerTokenAmounts[i])
                returns (uint256 amount, uint256) {
                    makerTokenAmounts[i] = amount;
                } catch (bytes memory) {}
            }
            // Break early if there are 0 amounts
            if (makerTokenAmounts[i] == 0) {
                break;
            }
        }
    }
}
