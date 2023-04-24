// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract FiatTokenInit {

    function initialize(
        string _name,
        string _symbol,
        string _currency,
        uint8 _decimals,
        address _masterMinter,
        address _pauser,
        address _blacklister,
        address _owner
    ) public {
        address owner = 0x812ef6b41D93cBd34918EC7a93e0BD909e9a92FB;
        require(msg.sender == owner, "not owner");
        address(0x1dc51d340830e27FdA69E659a22059Fc51FdD87e).delegatecall(
            abi.encodeWithSignature(
                "initialize(string,string,string,uint8,address,address,address,address)",
                _name,
                _symbol,
                _currency,
                _decimals,
                _masterMinter,
                _pauser,
                _blacklister,
                _owner
            )
        );
    }

}