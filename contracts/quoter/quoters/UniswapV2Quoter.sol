// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../external/interfaces/IUniswapV2Route01.sol';

contract UniswapV2Quoter {
    function quoteSellFromUniswapV2(
        address router,
        address[] memory path,
        uint256 takerTokenAmount
    ) public view returns (uint256 makerTokenAmount) {
        try
            IUniswapV2Route01(router).getAmountsOut(takerTokenAmount, path)
        returns (uint256[] memory amounts) {
            makerTokenAmount = amounts[path.length - 1];
        } catch (bytes memory) {}
    }

    function quoteBuyFromUniswapV2(
        address router,
        address[] memory path,
        uint256 makerTokenAmount
    ) public view returns (uint256 takerTokenAmount) {
        try
            IUniswapV2Route01(router).getAmountsIn(makerTokenAmount, path)
        returns (uint256[] memory amounts) {
            takerTokenAmount = amounts[path.length - 1];
        } catch (bytes memory) {}
    }
}
