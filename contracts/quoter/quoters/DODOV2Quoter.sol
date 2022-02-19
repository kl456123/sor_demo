// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract DODOV2Quoter {
    function quoteSellFromDODOV2(
        address takerToken,
        address makerToken,
        uint256 takerTokenAmount
    ) public view returns (uint256 makerTokenAmount) {}

    function quoteBuyFromDODOV2(
        address takerToken,
        address makerToken,
        uint256 makerTokenAmount
    ) public view returns (uint256 takerTokenAmount) {}
}
