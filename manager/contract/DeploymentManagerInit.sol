// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract DeploymentManagerInit {
    address private _deploymentManager;
    uint private _deploymentNonce;

    constructor(address manager) {
        _deploymentManager = manager;
    }

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");
        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
    }

    function getEthSignatureHash(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    function create(bytes memory bytecode, uint128 callNonce, bytes memory signature) public returns (address) {
        require(_deploymentNonce == callNonce, "nonce missmatch");
        bytes32 messageHash = keccak256(abi.encodePacked(address(this), ":dcreate:", callNonce, bytecode));
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == _deploymentManager, "invalid signature");
        
        _deploymentNonce++;

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

    function call(address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature) public {
        require(_deploymentNonce == callNonce, "nonce missmatch");
        bytes32 messageHash = keccak256(abi.encodePacked(address(this), ":dcall:", callNonce, addr, amount, data));
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == _deploymentManager, "invalid signature");
        
        _deploymentNonce++;

        uint balance = address(this).balance;
        require(balance >= amount, "amount exceeds wallet balance");

        (bool sent, ) = payable(addr).call{value: amount}(data);
        require(sent, "call failed");
    }

    function nop(uint128 callNonce, bytes memory signature) public {
        require(_deploymentNonce == callNonce, "nonce missmatch");
        bytes32 messageHash = keccak256(abi.encodePacked(address(this), ":dnop:", callNonce));
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == _deploymentManager, "invalid signature");
        
        _deploymentNonce++;
    }
}
