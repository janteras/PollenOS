// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IProxyStorage {
    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    function implementation() external view returns (address);
    function admin() external view returns (address);
    function upgradeTo(address newImplementation) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function changeAdmin(address newAdmin) external;
} 