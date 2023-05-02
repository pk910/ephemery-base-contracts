// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract DeploymentAccountDelegateStorage {
    // proxy storage
    address public _owner;
    address public _manager;
    uint128 internal _nonce;

    // delegate storage
    uint128 internal _callNonce;
}

contract DeploymentAccountDelegate is DeploymentAccountDelegateStorage {

    function nonce() public view returns (uint128) {
        return _nonce;
    }

    function callNonce() public view returns (uint128) {
        return _callNonce;
    }

    function create(bytes memory bytecode) public payable returns (address) {
        require(msg.sender == _owner || msg.sender == _manager, "not owner or manager");

        _nonce++;
        _callNonce++;

        address addr;
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))

            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        require(addr != address(0), "create failed");
        return addr;
    }

    function create2(uint salt, bytes memory bytecode) public payable returns (address) {
        require(msg.sender == _owner || msg.sender == _manager, "not owner or manager");

        _nonce++;
        _callNonce++;

        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)

            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        require(addr != address(0), "create2 failed");
        return addr;
    }

    function call(address addr, uint256 amount, bytes calldata data) public payable {
        require(msg.sender == _owner || msg.sender == _manager, "not owner or manager");

        _callNonce++;

        uint balance = address(this).balance;
        require(balance >= amount, "amount exceeds wallet balance");

        (bool sent, ) = payable(addr).call{value: amount}(data);
        require(sent, "call failed");
    }

    function delegate(address addr, bytes calldata data) public payable {
        require(msg.sender == _owner || msg.sender == _manager, "not owner or manager");

        _callNonce++;

        (bool sent, ) = payable(addr).delegatecall(data);
        require(sent, "call failed");
    }

    function nop(uint16 count) public {
        require(msg.sender == _owner || msg.sender == _manager, "not owner or manager");

        _callNonce += count;
    }
}
