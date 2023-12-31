// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IERC20Transformer {
    struct TransformContext {
        // address payable recipient;
        bytes data;
    }

    function transform(TransformContext calldata context)
        external
        returns (bytes4 success);
}
