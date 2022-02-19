// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IQuoteERC20Feature {
    function _quoteERC20(bytes calldata callData)
        external
        view
        returns (uint256 outputTokenAmount);
}
