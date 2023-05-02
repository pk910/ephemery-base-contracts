// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./DeploymentAccount.sol";

interface IDeploymentAccount {
    function nonce() external view returns (uint128);
    function callNonce() external view returns (uint128);
    function create(bytes memory bytecode) external payable returns (address);
    function create2(uint salt, bytes memory bytecode) external payable returns (address);
    function call(address addr, uint256 amount, bytes calldata data) external payable;
    function delegate(address addr, bytes calldata data) external payable;
    function nop(uint16 count) external;
}

contract DeploymentManagerStorage {
    // proxy storage
    uint internal _version;
    address internal _manager;
    address internal _implementation;

    // manager storage
    mapping(bytes32 => address) internal _deploymentAccounts;
}

contract DeploymentManager is DeploymentManagerStorage {
    
    function version() public pure returns (uint) {
        return 1;
    }

    function checkVersion(uint minver) public pure {
        require(version() >= minver, "version lower");
    }

    function getDeploymentAccountImplementation() public pure returns (address) {
        return address(0xd7Dc947cB361260e6bd157C9b7edA59f68499605);
    }

    function _ensureDeploymentAccount(address account, uint account_salt) internal returns (address) {
        bytes32 deployerKey = keccak256(abi.encodePacked(account, account_salt));
        address deployerAddr = _deploymentAccounts[deployerKey];
        if(deployerAddr == address(0)) {
            deployerAddr = _createDeploymentAccount(account, deployerKey);
            require(deployerAddr != address(0), "could not create deployer");

            _deploymentAccounts[deployerKey] = deployerAddr;
        }
        return deployerAddr;
    }
    
    function _createDeploymentAccount(address account, bytes32 _salt) internal returns (address) {
        return address(new DeploymentAccount{salt: _salt}(account));
    }

    function getDeployer(address account, uint account_salt) public view returns (address) {
        bytes32 deployerKey = keccak256(abi.encodePacked(account, account_salt));
        return _deploymentAccounts[deployerKey];
    }

    function createDeployer(address account, uint account_salt) public returns (address) {
        return _ensureDeploymentAccount(account, account_salt);
    }

    function getDeployerAddress(address account, uint account_salt) public view returns (address) {
        bytes32 deployerKey = keccak256(abi.encodePacked(account, account_salt));
        bytes memory bytecode = type(DeploymentAccount).creationCode;
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), address(this), deployerKey, keccak256(abi.encodePacked(bytecode, abi.encode(account)))
            )
        );
        return address (uint160(uint(hash)));
    }

    function getCreateAddress(address account, uint account_salt, uint nonce) public view returns (address) {
        address deployer = getDeployerAddress(account, account_salt);
        bytes memory data;
        if (nonce == 0x00)          data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(0x80));
        else if (nonce <= 0x7f)     data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, uint8(nonce));
        else if (nonce <= 0xff)     data = abi.encodePacked(bytes1(0xd7), bytes1(0x94), deployer, bytes1(0x81), uint8(nonce));
        else if (nonce <= 0xffff)   data = abi.encodePacked(bytes1(0xd8), bytes1(0x94), deployer, bytes1(0x82), uint16(nonce));
        else if (nonce <= 0xffffff) data = abi.encodePacked(bytes1(0xd9), bytes1(0x94), deployer, bytes1(0x83), uint24(nonce));
        else                        data = abi.encodePacked(bytes1(0xda), bytes1(0x94), deployer, bytes1(0x84), uint32(nonce));
        return address(uint160(uint256(keccak256(data))));
    }

    function getCreate2Address(address account, uint account_salt, uint salt, bytes memory bytecode) public view returns (address) {
        address deployer = getDeployerAddress(account, account_salt);
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), deployer, salt, keccak256(bytecode)
            )
        );
        return address (uint160(uint(hash)));
    }

    function create(uint account_salt, bytes memory bytecode) public payable returns (address) {
        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(msg.sender, account_salt));
        return deployer.create{value: msg.value}(bytecode);
    }

    function create2(uint account_salt, uint salt, bytes memory bytecode) public payable returns (address) {
        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(msg.sender, account_salt));
        return deployer.create2{value: msg.value}(salt, bytecode);
    }

    function call(uint account_salt, address addr, uint256 amount, bytes calldata data) public payable {
        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(msg.sender, account_salt));
        return deployer.call{value: msg.value}(addr, amount, data);
    }

    function delegate(uint account_salt, address addr, bytes calldata data) public payable {
        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(msg.sender, account_salt));
        return deployer.delegate{value: msg.value}(addr, data);
    }

    function nop(uint account_salt, uint16 count) public {
        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(msg.sender, account_salt));
        return deployer.nop(count);
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
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function getEthSignatureHash(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }


    function createFor(address account, uint account_salt, bytes memory bytecode, uint128 callNonce, bytes memory signature) public payable returns (address) {
        bytes32 messageHash = getCreateHash(account, account_salt, bytecode, callNonce);
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == account, "invalid signature");

        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(account, account_salt));
        require(deployer.callNonce() == callNonce, "nonce missmatch");

        return deployer.create{value: msg.value}(bytecode);
    }

    function create2For(address account, uint account_salt, uint salt, bytes memory bytecode, uint128 callNonce, bytes memory signature) public payable returns (address) {
        bytes32 messageHash = getCreate2Hash(account, account_salt, salt, bytecode, callNonce);
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == account, "invalid signature");

        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(account, account_salt));
        require(deployer.callNonce() == callNonce, "nonce missmatch");

        return deployer.create2{value: msg.value}(salt, bytecode);
    }

    function callFor(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature) public payable {
        bytes32 messageHash = getCallHash(account, account_salt, addr, amount, data, callNonce);
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == account, "invalid signature");

        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(account, account_salt));
        require(deployer.callNonce() == callNonce, "nonce missmatch");

        deployer.call{value: msg.value}(addr, amount, data);
    }

    function delegateFor(address account, uint account_salt, address addr, bytes memory data, uint128 callNonce, bytes memory signature) public payable {
        bytes32 messageHash = getDelegateHash(account, account_salt, addr, data, callNonce);
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == account, "invalid signature");

        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(account, account_salt));
        require(deployer.callNonce() == callNonce, "nonce missmatch");

        deployer.delegate{value: msg.value}(addr, data);
    }

    function nopFor(address account, uint account_salt, uint16 count, uint128 callNonce, bytes memory signature) public {
        bytes32 messageHash = getNopHash(account, account_salt, count, callNonce);
        require(recoverSigner(getEthSignatureHash(messageHash), signature) == account, "invalid signature");

        IDeploymentAccount deployer = IDeploymentAccount(_ensureDeploymentAccount(account, account_salt));
        require(deployer.callNonce() == callNonce, "nonce missmatch");

        deployer.nop(count);
    }

    function getCreateHash(address account, uint account_salt, bytes memory bytecode, uint128 nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(address(this), ":create:", account, account_salt, nonce, bytecode));
    }

    function getCreate2Hash(address account, uint account_salt, uint salt, bytes memory bytecode, uint128 nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(address(this), ":create2:", account, account_salt, nonce, salt, bytecode));
    }

    function getCallHash(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(address(this), ":call:", account, account_salt, nonce, addr, amount, data));
    }

    function getDelegateHash(address account, uint account_salt, address addr, bytes memory data, uint128 nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(address(this), ":delegate:", account, account_salt, nonce, addr, data));
    }

    function getNopHash(address account, uint account_salt, uint16 count, uint128 nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(address(this), ":nop:", account, account_salt, count, nonce));
    }

}
