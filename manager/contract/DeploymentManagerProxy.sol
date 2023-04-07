// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract DeploymentManagerProxy {
    uint private _version;
    address private _manager;
    address private _implementation;

    constructor() {
        _manager = msg.sender;
    }

    modifier ifManager() {
        if (msg.sender == _manager) {
            _;
        } else {
            _fallback();
        }
    }

    function _fallback() internal {
        require(_implementation != address(0), "no implementation");
        _delegate(_implementation);
    }

    function _delegate(address impl) internal virtual {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    fallback() external payable {
        _fallback();
    }

    receive() external payable {
        _fallback();
    }

    function implementation() public view returns (address) {
        return _implementation;
    }

    function upgradeTo(address addr) external ifManager {
        _implementation = addr;
    }

}
