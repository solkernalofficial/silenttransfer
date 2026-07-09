// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SilentPaymaster
/// @notice Mock gasless paymaster for SilentTransfer stealth withdrawals.
/// @dev Production use requires full ERC-4337 integration with an EntryPoint contract.
contract SilentPaymaster is Ownable {
    uint256 public feeBasisPoints; // 100 = 1%
    address public feeCollector;
    bool public paused;

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event PaymasterPaused();
    event PaymasterUnpaused();
    event WithdrawalSponsored(
        address indexed user,
        address indexed stealthAddress,
        address token,
        uint256 amount,
        uint256 fee
    );

    error PaymasterIsPaused();
    error InvalidFee();
    error ZeroAddress();

    modifier whenNotPaused() {
        if (paused) revert PaymasterIsPaused();
        _;
    }

    constructor(address _feeCollector, address initialOwner) Ownable(initialOwner) {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
        feeBasisPoints = 0; // 0% now; planned 50 bps (0.5%) for ops + buyback
    }

    function setFeeBasisPoints(uint256 _feeBasisPoints) external onlyOwner {
        if (_feeBasisPoints > 1000) revert InvalidFee();
        emit FeeUpdated(feeBasisPoints, _feeBasisPoints);
        feeBasisPoints = _feeBasisPoints;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        emit FeeCollectorUpdated(feeCollector, _feeCollector);
        feeCollector = _feeCollector;
    }

    function pause() external onlyOwner {
        paused = true;
        emit PaymasterPaused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit PaymasterUnpaused();
    }

    function validateAndSponsor(
        address /*user*/,
        address /*stealthAddress*/,
        address /*token*/,
        uint256 amount,
        uint256 /*gasEstimate*/
    ) external view whenNotPaused returns (uint256 fee) {
        return (amount * feeBasisPoints) / 10000;
    }

    function executeGaslessWithdraw(
        address user,
        address /*stealthAddress*/,
        address token,
        uint256 amount,
        uint256 /*gasEstimate*/
    ) external whenNotPaused returns (bool) {
        uint256 fee = (amount * feeBasisPoints) / 10000;
        emit WithdrawalSponsored(user, address(0), token, amount, fee);
        return true;
    }
}
