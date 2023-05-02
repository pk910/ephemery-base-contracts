// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract DeploymentAccountStorage {
    address public _owner;
    address public _manager;
    uint128 internal _nonce;
    uint128 internal _callNonce;
}

interface IDeploymentManager {
    function getDeploymentAccountImplementation() external pure returns (address);
}

contract DeploymentAccount is DeploymentAccountStorage {
    constructor(address owner) {
        _owner = owner;
        _manager = msg.sender;
        _nonce = 1;
    }

    function implementation() public view returns (address) {
        return IDeploymentManager(_manager).getDeploymentAccountImplementation();
    }

    function _fallback() internal {
        address _impl = implementation();
        require(_impl != address(0), "no implementation");
        _delegate(_impl);
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
}
