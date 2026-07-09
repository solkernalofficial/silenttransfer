// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockStockToken is ERC20, Ownable {
    mapping(address => bool) public whitelisted;
    bool public complianceEnabled;

    event ComplianceToggled(bool enabled);
    event AddressWhitelisted(address indexed addr);
    event AddressRemoved(address indexed addr);

    error NotWhitelisted(address addr);
    error ZeroAddress();

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        complianceEnabled = true;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    function setWhitelistStatus(address addr, bool status) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        whitelisted[addr] = status;
        if (status) {
            emit AddressWhitelisted(addr);
        } else {
            emit AddressRemoved(addr);
        }
    }

    function toggleCompliance() external onlyOwner {
        complianceEnabled = !complianceEnabled;
        emit ComplianceToggled(complianceEnabled);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (complianceEnabled && from != address(0) && to != address(0)) {
            if (!whitelisted[to]) {
                revert NotWhitelisted(to);
            }
        }
        super._update(from, to, value);
    }
}
