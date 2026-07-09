// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockComplianceOracle is Ownable {
    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public whitelistTimestamp;

    event AddressWhitelisted(address indexed addr, uint256 timestamp);
    event AddressRemoved(address indexed addr);

    error ZeroAddress();

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    function whitelistAddress(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        whitelisted[addr] = true;
        whitelistTimestamp[addr] = block.timestamp;
        emit AddressWhitelisted(addr, block.timestamp);
    }

    function removeAddress(address addr) external onlyOwner {
        whitelisted[addr] = false;
        delete whitelistTimestamp[addr];
        emit AddressRemoved(addr);
    }

    function isWhitelisted(address addr) external view returns (bool) {
        return whitelisted[addr];
    }

    /// @notice Checks if the stealth address can receive tokens (for mock compliance check)
    function canReceive(address /*sender*/, address recipient, uint256 /*amount*/)
        external
        view
        returns (bool)
    {
        return whitelisted[recipient];
    }
}
