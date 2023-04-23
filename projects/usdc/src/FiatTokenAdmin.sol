// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract FiatTokenAdmin {
    address private owner;

    constructor() {
        owner = msg.sender;
    }

    function call(address addr, bytes calldata data) public {
        require(msg.sender == owner, "not owner");

        (bool sent, ) = payable(addr).call{value: 0}(data);
        require(sent, "call failed");
    }

}
