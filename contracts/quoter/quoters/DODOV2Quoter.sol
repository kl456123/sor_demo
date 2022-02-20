// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../external/interfaces/IDODOV2.sol';

contract DODOV2Quoter {
    function quoteSellFromDODOV2(
        address registry,
        uint256 offset,
        address takerToken,
        address makerToken,
        uint256 takerTokenAmount
    )
        public
        view
        returns (
            bool sellBase,
            address pool,
            uint256 makerTokenAmount
        )
    {
        (pool, sellBase) = _getNextDODOV2Pool(
            registry,
            offset,
            takerToken,
            makerToken
        );
        if (sellBase) {
            try
                IDODOV2Pool(pool).querySellBase(address(0), takerTokenAmount)
            returns (uint256 amount, uint256) {
                makerTokenAmount = amount;
            } catch {
                makerTokenAmount = 0;
            }
        } else {
            try
                IDODOV2Pool(pool).querySellQuote(address(0), takerTokenAmount)
            returns (uint256 amount, uint256) {
                makerTokenAmount = amount;
            } catch {
                makerTokenAmount = 0;
            }
        }
    }

    function quoteBuyFromDODOV2(
        address takerToken,
        address makerToken,
        uint256 makerTokenAmount
    ) public view returns (uint256 takerTokenAmount) {}

    function _getNextDODOV2Pool(
        address registry,
        uint256 offset,
        address takerToken,
        address makerToken
    ) internal view returns (address machine, bool sellBase) {
        address[] memory machines = IDODOV2Registry(registry).getDODOPool(
            takerToken,
            makerToken
        );
        sellBase = true;
        if (machines.length == 0) {
            machines = IDODOV2Registry(registry).getDODOPool(
                makerToken,
                takerToken
            );
            sellBase = false;
        }
        if (offset >= machines.length) {
            return (address(0), false);
        }
        machine = machines[offset];
    }
}
