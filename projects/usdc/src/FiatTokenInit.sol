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
        address owner = 0xAAf6278C3B4C8f404DfF1D1C845d6F21CDF68729;
        require(msg.sender == owner, "not owner");
        address(0x495329339740ec6FD192C2F616815498181e7065).delegatecall(
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