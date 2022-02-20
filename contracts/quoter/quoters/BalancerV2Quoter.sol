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
    ) public returns (uint256 makerTokenAmount) {
        IBalancerV2Vault vault = IBalancerV2Vault(poolInfo.vault);
        IBalancerV2Vault.FundManagement memory swapFunds = _createSwapFunds();
        IBalancerV2Vault.BatchSwapStep[] memory swapSteps = _createSwapStep(
            poolInfo,
            takerTokenAmount
        );
        IAsset[] memory swapAssets = new IAsset[](2);
        swapAssets[0] = IAsset(takerToken);
        swapAssets[1] = IAsset(makerToken);
        try
            vault.queryBatchSwap(
                IBalancerV2Vault.SwapKind.GIVEN_IN,
                swapSteps,
                swapAssets,
                swapFunds
            )
        returns (int256[] memory amounts) {
            // output is negative
            makerTokenAmount = uint256(amounts[1] * -1);
        } catch (bytes memory) {}
    }

    function quoteBuyFromBalancerV2(
        BalancerV2PoolInfo memory poolInfo,
        address takerToken,
        address makerToken,
        uint256 makerTokenAmount
    ) public returns (uint256 takerTokenAmount) {
        IBalancerV2Vault vault = IBalancerV2Vault(poolInfo.vault);
        IBalancerV2Vault.FundManagement memory swapFunds = _createSwapFunds();
        IBalancerV2Vault.BatchSwapStep[] memory swapSteps = _createSwapStep(
            poolInfo,
            makerTokenAmount
        );
        IAsset[] memory swapAssets = new IAsset[](2);
        swapAssets[0] = IAsset(takerToken);
        swapAssets[1] = IAsset(makerToken);
        try
            vault.queryBatchSwap(
                IBalancerV2Vault.SwapKind.GIVEN_OUT,
                swapSteps,
                swapAssets,
                swapFunds
            )
        returns (int256[] memory amounts) {
            makerTokenAmount = uint256(amounts[0]);
        } catch (bytes memory) {}
    }

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
