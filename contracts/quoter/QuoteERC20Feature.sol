// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './quoters/CurveQuoter.sol';
import './quoters/UniswapV2Quoter.sol';
import './quoters/DODOV2Quoter.sol';
import './quoters/BalancerV2Quoter.sol';
import './interfaces/IQuoteERC20Feature.sol';

contract QuoteERC20Feature is
    IQuoteERC20Feature,
    CurveQuoter,
    UniswapV2Quoter,
    DODOV2Quoter,
    BalancerV2Quoter
{
    function _quoteERC20(bytes calldata callData)
        public
        view
        override
        returns (uint256 outputTokenAmount)
    {
        (bool success, bytes memory resultData) = address(this).staticcall(
            callData
        );
        if (!success) {
            revert('BatchSellQuoteFailedError');
        }
        outputTokenAmount = abi.decode(resultData, (uint256));
    }
}
