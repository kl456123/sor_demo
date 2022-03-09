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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IUniswapV3Quoter {
    function factory() external view returns (IUniswapV3Factory);

    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        returns (uint256 amountOut);

    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        returns (uint256 amountIn);
}

interface IUniswapV3Factory {
    function getPool(
        IERC20 a,
        IERC20 b,
        uint24 fee
    ) external view returns (IUniswapV3Pool pool);
}

interface IUniswapV3Pool {
    function token0() external view returns (IERC20);

    function token1() external view returns (IERC20);

    function fee() external view returns (uint24);
}

contract UniswapV3Sampler {
    /// @dev Gas limit for UniswapV3 calls. This is 100% a guess.
    uint256 private constant QUOTE_GAS = 300e3;

    /// @dev Sample sell quotes from UniswapV3.
    /// @param quoter UniswapV3 Quoter contract.
    /// @param path Token route. Should be takerToken -> makerToken
    /// @param takerTokenAmounts Taker token sell amount for each sample.
    /// @return makerTokenAmounts Maker amounts bought at each taker token
    ///         amount.
    function sampleSellsFromUniswapV3(
        IUniswapV3Quoter quoter,
        IERC20[] memory path,
        uint256[] memory takerTokenAmounts,
        uint24[] memory fees
    ) public returns (uint256[] memory makerTokenAmounts) {
        makerTokenAmounts = new uint256[](takerTokenAmounts.length);

        for (uint256 i = 0; i < takerTokenAmounts.length; ++i) {
            // Pick the best result from all the paths.
            uint256 topBuyAmount = 0;
            bytes memory uniswapPath = _toUniswapPath(path, fees);
            try
                quoter.quoteExactInput{gas: QUOTE_GAS}(
                    uniswapPath,
                    takerTokenAmounts[i]
                )
            returns (uint256 buyAmount) {
                topBuyAmount = buyAmount;
            } catch {}
            // Break early if we can't complete the buys.
            if (topBuyAmount == 0) {
                break;
            }
            makerTokenAmounts[i] = topBuyAmount;
        }
    }

    /// @dev Sample buy quotes from UniswapV3.
    /// @param quoter UniswapV3 Quoter contract.
    /// @param path Token route. Should be takerToken -> makerToken.
    /// @param makerTokenAmounts Maker token buy amount for each sample.
    /// @return takerTokenAmounts Taker amounts sold at each maker token
    ///         amount.
    function sampleBuysFromUniswapV3(
        IUniswapV3Quoter quoter,
        IERC20[] memory path,
        uint256[] memory makerTokenAmounts,
        uint24[] memory fees
    ) public returns (uint256[] memory takerTokenAmounts) {
        IERC20[] memory reversedPath = _reverseTokenPath(path);

        takerTokenAmounts = new uint256[](makerTokenAmounts.length);

        for (uint256 i = 0; i < makerTokenAmounts.length; ++i) {
            // Pick the best result from all the paths.
            bytes memory topUniswapPath;
            uint256 topSellAmount = 0;
            // quoter requires path to be reversed for buys.
            bytes memory uniswapPath = _toUniswapPath(
                reversedPath,
                _reversePoolPath(fees)
            );
            try
                quoter.quoteExactOutput{gas: QUOTE_GAS}(
                    uniswapPath,
                    makerTokenAmounts[i]
                )
            returns (uint256 sellAmount) {
                topSellAmount = sellAmount;
            } catch {}
            // Break early if we can't complete the buys.
            if (topSellAmount == 0) {
                break;
            }
            takerTokenAmounts[i] = topSellAmount;
        }
    }

    function _reverseTokenPath(IERC20[] memory tokenPath)
        private
        returns (IERC20[] memory reversed)
    {
        reversed = new IERC20[](tokenPath.length);
        for (uint256 i = 0; i < tokenPath.length; ++i) {
            reversed[i] = tokenPath[tokenPath.length - i - 1];
        }
    }

    function _reversePoolPath(uint24[] memory fees)
        private
        returns (uint24[] memory reversed)
    {
        reversed = new uint24[](fees.length);
        for (uint256 i = 0; i < fees.length; ++i) {
            reversed[i] = fees[fees.length - i - 1];
        }
    }

    function _isValidPool(IUniswapV3Pool pool)
        private
        view
        returns (bool isValid)
    {
        // Check if it has been deployed.
        {
            uint256 codeSize;
            assembly {
                codeSize := extcodesize(pool)
            }
            if (codeSize == 0) {
                return false;
            }
        }
        // Must have a balance of both tokens.
        if (pool.token0().balanceOf(address(pool)) == 0) {
            return false;
        }
        if (pool.token1().balanceOf(address(pool)) == 0) {
            return false;
        }
        return true;
    }

    function _toUniswapPath(IERC20[] memory tokenPath, uint24[] memory poolFees)
        private
        pure
        returns (bytes memory uniswapPath)
    {
        require(
            tokenPath.length >= 2 && tokenPath.length == poolFees.length + 1,
            'UniswapV3Sampler/invalid path lengths'
        );
        // Uniswap paths are tightly packed as:
        // [token0, token0token1PairFee, token1, token1Token2PairFee, token2, ...]
        uniswapPath = new bytes(tokenPath.length * 20 + poolFees.length * 3);
        uint256 o;
        assembly {
            o := add(uniswapPath, 32)
        }
        for (uint256 i = 0; i < tokenPath.length; ++i) {
            if (i > 0) {
                uint24 poolFee = poolFees[i - 1];
                assembly {
                    mstore(o, shl(232, poolFee))
                    o := add(o, 3)
                }
            }
            IERC20 token = tokenPath[i];
            assembly {
                mstore(o, shl(96, token))
                o := add(o, 20)
            }
        }
    }
}
