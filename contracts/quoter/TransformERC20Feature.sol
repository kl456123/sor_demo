// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './interfaces/ITransformERC20Feature.sol';
import './transformers/IERC20Transformer.sol';

contract TransformERC20Feature is ITransformERC20Feature {
    modifier onlySelf() virtual {
        if (msg.sender != address(this)) {
            revert('ONLYSELF');
        }
        _;
    }

    function transformERC20(
        IERC20 inputToken,
        IERC20 outputToken,
        uint256 inputTokenAmount,
        uint256 minOutputTokenAmount,
        Transformation[] memory transformations
    ) public payable override returns (uint256 outputTokenAmount) {
        return
            _transformERC20Private(
                TransformERC20Args({
                    inputToken: inputToken,
                    outputToken: outputToken,
                    inputTokenAmount: inputTokenAmount,
                    transformations: transformations,
                    minOutputTokenAmount: minOutputTokenAmount
                })
            );
    }

    function _transformERC20(TransformERC20Args memory args)
        public
        payable
        virtual
        override
        onlySelf
        returns (uint256 outputTokenAmount)
    {
        return _transformERC20Private(args);
    }

    function _transformERC20Private(TransformERC20Args memory args)
        private
        returns (uint256 outputTokenAmount)
    {
        {
            for (uint256 i = 0; i < args.transformations.length; ++i) {
                _executeTransformation(args.transformations[i]);
            }
        }
    }

    function _executeTransformation(Transformation memory transformation)
        private
    {
        address transformer = transformation.transformer;
        (bool success, bytes memory resultData) = transformer.delegatecall(
            abi.encodeWithSelector(
                IERC20Transformer.transform.selector,
                IERC20Transformer.TransformContext({data: transformation.data})
            )
        );

        if (!success) {
            revert('DelegateCallFailedError');
        }

        if (resultData.length != 32) {
            revert('TransformFailedError');
        }
    }
}
