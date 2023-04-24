// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract UpgradebleStormSenderInit {

    function initialize() public {
        address owner = 0x973eD674a019A47c8e733aE5932BB52a22E6B3f0;
        require(msg.sender == owner, "not owner");
        address(0xCC799D8b255CB9CEfa38475aaD188d18d7B68981).delegatecall(
            abi.encodeWithSignature("initialize(address)", owner)
        );
    }
}