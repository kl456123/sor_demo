// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2020 ZeroEx Intl.

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

import './BalancerSampler.sol';
import './BalancerV2Sampler.sol';
import './CurveSampler.sol';
import './DODOSampler.sol';
import './DODOV2Sampler.sol';
import './UniswapV2Sampler.sol';
import './UniswapV3Sampler.sol';
import './MakerPSMSampler.sol';
import './BancorSampler.sol';
import './KyberSampler.sol';
import './NativeOrderSampler.sol';

contract ERC20BridgeSampler is
    BalancerSampler,
    BalancerV2Sampler,
    CurveSampler,
    DODOSampler,
    DODOV2Sampler,
    UniswapV2Sampler,
    UniswapV3Sampler,
    MakerPSMSampler,
    BancorSampler,
    KyberSampler,
    NativeOrderSampler
{
    struct CallResults {
        bytes data;
        bool success;
    }

    /// @dev Call multiple public functions on this contract in a single transaction.
    /// @param callDatas ABI-encoded call data for each function call.
    /// @return callResults ABI-encoded results data for each call.
    function batchCall(bytes[] calldata callDatas)
        external
        returns (CallResults[] memory callResults)
    {
        callResults = new CallResults[](callDatas.length);
        for (uint256 i = 0; i != callDatas.length; ++i) {
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
