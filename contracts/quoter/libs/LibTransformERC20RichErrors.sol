// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library LibTransformERC20RichErrors {
    function TransformerFailedError(
        address transformer,
        bytes memory transformerData,
        bytes memory resultData
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSelector(
                bytes4(
                    keccak256('TransformerFailedError(address,bytes,bytes)')
                ),
                transformer,
                transformerData,
                resultData
            );
    }
}
