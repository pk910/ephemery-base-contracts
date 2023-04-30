// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./TransferHelper.sol";
import "./IUniswapV2Router02.sol";

contract PairLiquidityProvider is IERC721Receiver {
    address private _owner;
    address private _router;
    address private _weth9;

    constructor(address router, address weth9) {
        _owner = msg.sender;
        _router = router;
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

    function provideLiquidity(address token0, address token1, uint256 amount0Desired, uint256 amount1Desired) public payable 
    returns (uint amountA, uint amountB, uint liquidity) {
        require(msg.sender == _owner, "not owner");

        if(token0 != _weth9) {
            TransferHelper.safeApprove(token0, _router, amount0Desired);
        }
        if(token1 != _weth9) {
            TransferHelper.safeApprove(token1, _router, amount1Desired);
        }

        if(token0 == _weth9) {
            (amountB, amountA, liquidity) = IUniswapV2Router02(_router).addLiquidityETH{value: msg.value}(token1, amount1Desired, 0, amount0Desired, address(this), block.timestamp);
        }
        else if(token1 == _weth9) {
            (amountA, amountB, liquidity) = IUniswapV2Router02(_router).addLiquidityETH{value: msg.value}(token0, amount0Desired, 0, amount1Desired, address(this), block.timestamp);
        }
        else {
            (amountA, amountB, liquidity) = IUniswapV2Router02(_router).addLiquidity(token0, token1, amount0Desired, amount1Desired, 0, 0, address(this), block.timestamp);
        }

        if(address(this).balance > 0) {
            (bool sent, ) = payable(tx.origin).call{value: address(this).balance}("");
            require(sent, "failed to send refund");
        }
    }

}