// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract UpgradebleStormSenderInit {

    function initialize() public {
        address owner = 0xd703296b1A7A14b25f737a07AbedB365d11EeE63;
        require(msg.sender == owner, "not owner");
        address(0x2b531cF73EFA053E6c097eF0407267f6325210b2).delegatecall(
            abi.encodeWithSignature("initialize(address)", owner)
        );
    }
}