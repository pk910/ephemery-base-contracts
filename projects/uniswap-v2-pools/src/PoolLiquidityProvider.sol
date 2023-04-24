// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./TransferHelper.sol";

struct MintParams {
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
}

interface IPositionManager {
    function mint(MintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );
    function refundETH() external payable;
}

contract PoolLiquidityProvider is IERC721Receiver {
    address private _owner;
    address private _positionManager;
    address private _weth9;

    constructor(address positionManager, address weth9) {
        _owner = msg.sender;
        _positionManager = positionManager;
        _weth9 = weth9;
    }

    receive() external payable {
    }

    function onERC721Received(address, address, uint256, bytes calldata) public pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function call(address addr, bytes calldata data) public payable {
        require(msg.sender == _owner, "not owner");

        (bool sent, ) = payable(addr).call{value: msg.value}(data);
        require(sent, "call failed");
    }

    function delegate(address addr, bytes calldata data) public {
        require(msg.sender == _owner, "not owner");

        (bool sent, ) = payable(addr).delegatecall(data);
        require(sent, "call failed");
    }

    function provideLiquidity(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired) public payable 
    returns (uint256, uint128, uint256, uint256) {
        require(msg.sender == _owner, "not owner");

        if(token0 != _weth9) {
            TransferHelper.safeApprove(token0, _positionManager, amount0Desired);
        }
        if(token1 != _weth9) {
            TransferHelper.safeApprove(token1, _positionManager, amount1Desired);
        }

        MintParams memory params = MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        });

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = IPositionManager(_positionManager).mint{value: msg.value}(params);
        IPositionManager(_positionManager).refundETH();

        if(address(this).balance > 0) {
            (bool sent, ) = payable(tx.origin).call{value: address(this).balance}("");
            require(sent, "failed to send refund");
        }

        return (tokenId, liquidity, amount0, amount1);
    }

}