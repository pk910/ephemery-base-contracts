
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint value) external;
}

contract TokenFaucet is Ownable {

    function rescueCall(address addr, uint256 amount, bytes calldata data) public onlyOwner {
        uint balance = address(this).balance;
        require(balance >= amount, "amount exceeds wallet balance");

        (bool sent, ) = payable(addr).call{value: amount}(data);
        require(sent, "call failed");
    }

    function getPrice(address token, uint256 amount) public view returns (uint256) {
        // just give out tokens for 0.1 ETH / token
        uint256 baseFee = 100000000000000000; // 0.1 ETH

        uint8 decimals;
        try IERC20(token).decimals() returns (uint8 dec) {
            decimals = dec;
        } catch {
            decimals = 0;
        }

        uint256 totalFee;
        if(decimals > 0) {
            uint256 decimalFactor = 10**decimals;
            if(baseFee < decimalFactor && decimalFactor / baseFee > 0) {
                uint256 atomicBase = (decimalFactor / baseFee);
                uint256 roundingGap = amount % atomicBase;
                if(roundingGap > 0) {
                    // round up to mitigate gap
                    amount += (atomicBase - (roundingGap));
                }
            }
            totalFee = amount * baseFee / decimalFactor;
        }
        else {
            totalFee = amount * baseFee;
        }

        return totalFee;
    }

    function requestToken(address token, uint256 amount) public payable {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(amount <= balance, "amount exceeds faucet balance");

        uint256 totalFee = getPrice(token, amount);
        require(msg.value >= totalFee, "payment amount too low");

        // send token
        IERC20(token).transfer(msg.sender, amount);

        uint256 refund = msg.value - totalFee;
        if(refund > 0) {
            (bool sent, ) = payable(msg.sender).call{value: refund}("");
            require(sent, "failed to send refund");
        }
    }

}
