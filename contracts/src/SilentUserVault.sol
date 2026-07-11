// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SilentUserVault
 * @notice Wallet-bound private balance vault (no local notes / no claim for recipients).
 *
 * UX:
 *  1) A deposits ETH → credited to A's wallet balance inside the vault (C).
 *  2) Later, A withdraws any amount (once or in pieces, any time) to B / many wallets.
 *  3) B receives ETH from the vault contract — B never visits the website.
 *  4) Control key = the wallet that deposits/signs (msg.sender). No note backup.
 *
 * Privacy (honest):
 *  - B does not see A's address on the *receive* leg (from = vault).
 *  - On a public chain, A→vault deposits and A-triggered withdraws are still visible.
 *  - Amount/timing analysis can still link deposit and withdraw; not full ZK anonymity.
 *  - “ZK” upgrade path: proofs over balance commitments without revealing msg.sender links.
 */
contract SilentUserVault is Ownable, ReentrancyGuard {
    uint16 public feeBps; // on deposit, e.g. 50 = 0.5%
    address public feeRecipient;

    mapping(address => uint256) public balanceOf;
    uint256 public totalBalances;
    uint256 public totalFeesCollected;

    event FeeBpsUpdated(uint16 oldBps, uint16 newBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event Deposited(address indexed account, uint256 gross, uint256 fee, uint256 credited);
    event Withdrawn(address indexed account, address indexed to, uint256 amount);
    event Sweep(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroValue();
    error InvalidFee();
    error InsufficientBalance();
    error LengthMismatch();
    error TransferFailed();

    constructor(address initialOwner, address feeRecipient_, uint16 feeBps_) Ownable(initialOwner) {
        if (initialOwner == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > 1000) revert InvalidFee();
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        emit FeeRecipientUpdated(address(0), feeRecipient_);
        emit FeeBpsUpdated(0, feeBps_);
    }

    function setFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > 1000) revert InvalidFee();
        emit FeeBpsUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    /**
     * @notice Deposit ETH into your private vault balance. Key = your wallet (msg.sender).
     */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroValue();
        uint256 fee = (msg.value * uint256(feeBps)) / 10_000;
        uint256 credited = msg.value - fee;

        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            if (!feeOk) revert TransferFailed();
            totalFeesCollected += fee;
        }

        balanceOf[msg.sender] += credited;
        totalBalances += credited;
        emit Deposited(msg.sender, msg.value, fee, credited);
    }

    /**
     * @notice Withdraw any amount from your vault balance to any wallet (B).
     *         B receives from this contract — no website / no claim for B.
     */
    function withdraw(address to, uint256 amount) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroValue();
        uint256 bal = balanceOf[msg.sender];
        if (bal < amount) revert InsufficientBalance();

        balanceOf[msg.sender] = bal - amount;
        totalBalances -= amount;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, to, amount);
    }

    /**
     * @notice Withdraw to many wallets in one tx (batch). Sum(amounts) ≤ your balance.
     */
    function withdrawMany(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant {
        uint256 n = recipients.length;
        if (n == 0 || n != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroValue();
            total += amounts[i];
        }

        uint256 bal = balanceOf[msg.sender];
        if (bal < total) revert InsufficientBalance();

        balanceOf[msg.sender] = bal - total;
        totalBalances -= total;

        for (uint256 i = 0; i < n; i++) {
            (bool ok, ) = recipients[i].call{value: amounts[i]}("");
            if (!ok) revert TransferFailed();
            emit Withdrawn(msg.sender, recipients[i], amounts[i]);
        }
    }

    /// @notice Liquid ETH not owed to user balances (should be ~0 in healthy state)
    function freeBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        if (bal <= totalBalances) return 0;
        return bal - totalBalances;
    }

    function sweepFree(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > freeBalance()) revert InsufficientBalance();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Sweep(to, amount);
    }

    receive() external payable {
        // Accidental plain ETH: treat as deposit for sender
        if (msg.value == 0) return;
        uint256 fee = (msg.value * uint256(feeBps)) / 10_000;
        uint256 credited = msg.value - fee;
        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            if (feeOk) totalFeesCollected += fee;
            else credited = msg.value; // if fee fail, credit all (best-effort)
        }
        balanceOf[msg.sender] += credited;
        totalBalances += credited;
        emit Deposited(msg.sender, msg.value, fee, credited);
    }
}
