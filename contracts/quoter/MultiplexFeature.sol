// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './interfaces/IMultiplexFeature.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './multiplex/MultiplexTransformERC20.sol';
import './multiplex/MultiplexQuoter.sol';
import 'hardhat/console.sol';

contract MultiplexFeature is
    IMultiplexFeature,
    MultiplexTransformERC20,
    MultiplexQuoter
{
    using SafeMath for uint256;

    function _executeBatchSell(BatchSellParams memory params)
        private
        returns (BatchSellState memory state)
    {
        console.log('params.length: ', params.calls.length);
        for (uint256 i = 0; i < params.calls.length; ++i) {
            if (state.soldAmount >= params.sellAmount) {
                break;
            }
            BatchSellSubcall memory subcall = params.calls[i];
            uint256 inputTokenAmount = Math.min(
                subcall.sellAmount,
                params.sellAmount.sub(state.soldAmount)
            );
            if (subcall.id == MultiplexSubcall.MultiHopSell) {
                _nestedMultiHopSell(
                    state,
                    params,
                    subcall.data,
                    inputTokenAmount
                );
            } else if (subcall.id == MultiplexSubcall.TransformERC20) {
                _batchSellTransformERC20(
                    state,
                    params,
                    subcall.data,
                    inputTokenAmount
                );
            } else if (subcall.id == MultiplexSubcall.Quoter) {
                _batchSellQuote(state, params, subcall.data, inputTokenAmount);
            } else {
                revert('MultiplexFeature::_executeBatchSell/INVALID_SUBCALL');
            }
            console.log('soldAmount: ', state.soldAmount);
            console.log('boughtAmount: ', state.boughtAmount);
        }
    }

    function _executeMultiHopSell(MultiHopSellParams memory params)
        private
        returns (MultiHopSellState memory state)
    {
        state.outputTokenAmount = params.sellAmount;
        state.from = address(0);

        for (
            state.hopIndex = 0;
            state.hopIndex < params.calls.length;
            ++state.hopIndex
        ) {
            MultiHopSellSubcall memory subcall = params.calls[state.hopIndex];
            state.to = address(0);
            if (subcall.id == MultiplexSubcall.BatchSell) {
                _nestedBatchSell(state, params, subcall.data);
            } else {
                revert('MultiplexFeature::_executeBatchSell/INVALID_SUBCALL');
            }
            state.from = state.to;
        }
    }

    function multiplexBatchSellTokenForToken(
        IERC20 inputToken,
        IERC20 outputToken,
        BatchSellSubcall[] calldata calls,
        uint256 sellAmount,
        uint256 minBuyAmount
    ) public override returns (uint256 boughtAmount) {
        return
            _multiplexBatchSell(
                BatchSellParams({
                    inputToken: inputToken,
                    outputToken: outputToken,
                    sellAmount: sellAmount,
                    calls: calls,
                    recipient: msg.sender
                }),
                minBuyAmount
            );
    }

    function _multiplexBatchSell(
        BatchSellParams memory params,
        uint256 minBuyAmount
    ) private returns (uint256 boughtAmount) {
        uint256 balanceBefore = params.outputToken.balanceOf(params.recipient);
        BatchSellState memory state = _executeBatchSell(params);
        uint256 balanceDelta = params
            .outputToken
            .balanceOf(params.recipient)
            .sub(balanceBefore);
        // boughtAmount = Math.min(balanceDelta, state.boughtAmount);
        boughtAmount = state.boughtAmount;

        require(
            boughtAmount >= minBuyAmount,
            'MultiplexFeature::_multiplexBatchSell/UNDERBOUGHT'
        );
    }

    function multiplexMultiHopSellTokenForToken(
        address[] calldata tokens,
        MultiHopSellSubcall[] calldata calls,
        uint256 sellAmount,
        uint256 minBuyAmount
    ) public override returns (uint256 boughtAmount) {
        return
            _multiplexMultiHopSell(
                MultiHopSellParams({
                    tokens: tokens,
                    sellAmount: sellAmount,
                    calls: calls,
                    recipient: msg.sender
                }),
                minBuyAmount
            );
    }

    function _multiplexMultiHopSell(
        MultiHopSellParams memory params,
        uint256 minBuyAmount
    ) public returns (uint256 boughtAmount) {
        require(
            params.tokens.length == params.calls.length + 1,
            'MultiplexFeature::_multiplexMultiHopSell/MISMATCHED_ARRAY_LENGTHS'
        );
        IERC20 outputToken = IERC20(params.tokens[params.tokens.length - 1]);
        uint256 balanceBefore = outputToken.balanceOf(params.recipient);
        MultiHopSellState memory state = _executeMultiHopSell(params);
        uint256 balanceDelta = outputToken.balanceOf(params.recipient).sub(
            balanceBefore
        );
        // boughtAmount = Math.min(balanceDelta, state.outputTokenAmount);
        boughtAmount = state.outputTokenAmount;

        require(
            boughtAmount >= minBuyAmount,
            'MultiplexFeature::_multiplexMultiHopSell/UNDERBOUGHT'
        );
    }

    function _nestedBatchSell(
        MultiHopSellState memory state,
        MultiHopSellParams memory params,
        bytes memory data
    ) private {
        BatchSellParams memory batchSellParams;
        batchSellParams.calls = abi.decode(data, (BatchSellSubcall[]));
        batchSellParams.inputToken = IERC20(params.tokens[state.hopIndex]);
        batchSellParams.outputToken = IERC20(params.tokens[state.hopIndex + 1]);
        // the output token from previous sell is input token for current batch sell
        batchSellParams.sellAmount = state.outputTokenAmount;

        state.outputTokenAmount = _executeBatchSell(batchSellParams)
            .boughtAmount;
    }

    function _nestedMultiHopSell(
        BatchSellState memory state,
        BatchSellParams memory params,
        bytes memory data,
        uint256 sellAmount
    ) private {
        MultiHopSellParams memory multiHopSellParams;
        (multiHopSellParams.tokens, multiHopSellParams.calls) = abi.decode(
            data,
            (address[], MultiHopSellSubcall[])
        );
        multiHopSellParams.sellAmount = sellAmount;

        uint256 outputTokenAmount = _executeMultiHopSell(multiHopSellParams)
            .outputTokenAmount;
        state.soldAmount = state.soldAmount.add(sellAmount);
        state.boughtAmount = state.boughtAmount.add(outputTokenAmount);
    }
}
