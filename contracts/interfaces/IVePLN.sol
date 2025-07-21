// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVePLN {
    event Stake(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstake(address indexed user, uint256 amount);
    event ExtendLock(address indexed user, uint256 newLockDuration);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function maxLockDuration() external view returns (uint256);
    function minLockDuration() external view returns (uint256);
    function getLockInfo(address account) external view returns (uint256 amount, uint256 lockEnd);
    function stake(uint256 amount, uint256 lockDuration) external;
    function unstake() external;
    function extendLock(uint256 newLockDuration) external;
} 