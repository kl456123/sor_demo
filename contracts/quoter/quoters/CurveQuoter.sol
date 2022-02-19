// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../external/interfaces/ICurve.sol';

contract CurveQuoter {
    struct CurveInfo {
        address poolAddress;
        bytes4 sellQuoteFunctionSelector;
        bytes4 buyQuoteFunctionSelector;
    }

    function quoteSellFromCurve(
        CurveInfo memory curveInfo,
        uint256 fromTokenIdx,
        uint256 toTokenIdx,
        uint256 takerTokenAmount
    ) public view returns (uint256 makerTokenAmount) {
        (bool didSucceed, bytes memory resultData) = curveInfo
            .poolAddress
            .staticcall(
                abi.encodeWithSelector(
                    curveInfo.sellQuoteFunctionSelector,
                    fromTokenIdx,
                    toTokenIdx,
                    takerTokenAmount
                )
            );
        uint256 buyAmount = 0;
        if (didSucceed) {
            buyAmount = abi.decode(resultData, (uint256));
        }

        makerTokenAmount = buyAmount;
    }

    function quoteBuyFromCurve(
        CurveInfo memory curveInfo,
        uint256 fromTokenIdx,
        uint256 toTokenIdx,
        uint256 makerTokenAmount
    ) public view returns (uint256 takerTokenAmount) {
        (bool didSucceed, bytes memory resultData) = curveInfo
            .poolAddress
            .staticcall(
                abi.encodeWithSelector(
                    curveInfo.buyQuoteFunctionSelector,
                    fromTokenIdx,
                    toTokenIdx,
                    makerTokenAmount
                )
            );
        uint256 buyAmount = 0;
        if (didSucceed) {
            buyAmount = abi.decode(resultData, (uint256));
        }

        takerTokenAmount = buyAmount;
    }
}
