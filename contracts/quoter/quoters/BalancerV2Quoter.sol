// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../external/interfaces/IBalancerV2.sol';

contract BalancerV2Quoter {
    struct BalancerV2PoolInfo {
        bytes32 poolId;
        address vault;
    }

    function quoteSellFromBalancerV2(
        BalancerV2PoolInfo memory poolInfo,
        address takerToken,
        address makerToken,
        uint256 takerTokenAmount
    ) public view returns (uint256 makerTokenAmount) {}

    function quoteBuyFromBalancerV2(
        BalancerV2PoolInfo memory poolInfo,
        address takerToken,
        address makerToken,
        uint256 makerTokenAmount
    ) public view returns (uint256 takerTokenAmount) {}

    function _createSwapStep(BalancerV2PoolInfo memory poolInfo, uint256 amount)
        private
        pure
        returns (IBalancerV2Vault.BatchSwapStep[] memory)
    {
        IBalancerV2Vault.BatchSwapStep[]
            memory swapSteps = new IBalancerV2Vault.BatchSwapStep[](1);
        swapSteps[0] = IBalancerV2Vault.BatchSwapStep({
            poolId: poolInfo.poolId,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amount,
            userData: ''
        });

        return swapSteps;
    }

    function _createSwapFunds()
        private
        view
        returns (IBalancerV2Vault.FundManagement memory)
    {
        return
            IBalancerV2Vault.FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: payable(address(this)),
                toInternalBalance: false
            });
    }
}
