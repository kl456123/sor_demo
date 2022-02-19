// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './quoters/CurveQuoter.sol';
import './quoters/UniswapV2Quoter.sol';
import './quoters/DODOV2Quoter.sol';
import './quoters/BalancerV2Quoter.sol';

contract ERC20BridgeQuoter is
    CurveQuoter,
    UniswapV2Quoter,
    DODOV2Quoter,
    BalancerV2Quoter
{
    struct CallResults {
        bytes data;
        bool success;
    }

    function batchCall(bytes[] calldata callDatas)
        external
        returns (CallResults[] memory callResults)
    {
        callResults = new CallResults[](callDatas.length);

        for (uint256 i = 0; i < callDatas.length; ++i) {
            callResults[i].success = true;
            if (callDatas[i].length == 0) {
                continue;
            }
            (callResults[i].success, callResults[i].data) = address(this).call(
                callDatas[i]
            );
        }
    }
}
