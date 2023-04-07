// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract UpgradebleStormSenderInit {

    function initialize() public {
        address owner = 0xDe4E9ED4d9A8E8faBC6e5d458D0FAe10AbF84A7c;
        require(msg.sender == owner, "not owner");
        address(0xCE9358E8eE25984f6EEE4C69d49A11E115F92FEF).delegatecall(
            abi.encodeWithSignature("initialize(address)", owner)
        );
    }
}