// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SilentVault
 * @notice Pool vault for private multi-recipient payouts.
 *
 * Flow:
 *  1) A deposits ETH + optional protocol fee (one charge).
 *  2) Operator/relayer pays B, C, D… from the vault in separate txs.
 *  3) Recipients see funds from the vault address — not from A's wallet.
 *
 * Privacy note (honest):
 *  - On a public chain, A's deposit is still visible as A → Vault.
 *  - B's credit is Vault → B (so B does not see A's address on the receive leg).
 *  - Without ZK, amount/timing analysis can still partially link deposit and payout.
 *  - This is a practical "sender-hidden from recipient" vault, not full ZK anonymity.
 */
contract SilentVault is Ownable, ReentrancyGuard {
    uint16 public feeBps; // e.g. 50 = 0.5%
    address public feeRecipient;
    address public operator;

    /// @dev batchId => remaining reserved net balance for payouts
    mapping(bytes32 => uint256) public batchReserved;
    /// @dev payoutId => paid
    mapping(bytes32 => bool) public payoutDone;

    uint256 public totalReserved;
    uint256 public totalFeesCollected;

    event FeeBpsUpdated(uint16 oldBps, uint16 newBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    event Deposited(
        bytes32 indexed batchId,
        address indexed depositor,
        uint256 gross,
        uint256 fee,
        uint256 net
    );

    event Paid(
        bytes32 indexed batchId,
        bytes32 indexed payoutId,
        address indexed recipient,
        uint256 amount
    );

    event Sweep(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroValue();
    error InvalidFee();
    error LengthMismatch();
    error InsufficientReserve();
    error AlreadyPaid();
    error Unauthorized();
    error TransferFailed();

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner()) revert Unauthorized();
        _;
    }

    constructor(address initialOwner, address feeRecipient_, uint16 feeBps_) Ownable(initialOwner) {
        if (initialOwner == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > 1000) revert InvalidFee(); // max 10%
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        operator = initialOwner;
        emit FeeRecipientUpdated(address(0), feeRecipient_);
        emit FeeBpsUpdated(0, feeBps_);
        emit OperatorUpdated(address(0), initialOwner);
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

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    /**
     * @notice One-tx private send: A pays net+fee; vault immediately pays B/C/D.
     * @dev Recipients receive from this contract (not A). No claim step for B.
     *      Public chain still shows A→Vault and Vault→B in the same transaction.
     */
    function privateSend(
        bytes32 batchId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        uint256 n = recipients.length;
        if (batchId == bytes32(0)) revert ZeroValue();
        if (n == 0 || n != amounts.length) revert LengthMismatch();

        uint256 net = 0;
        for (uint256 i = 0; i < n; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroValue();
            net += amounts[i];
        }
        if (net == 0) revert ZeroValue();

        uint256 fee = (net * uint256(feeBps)) / 10_000;
        uint256 required = net + fee;
        if (msg.value < required) revert InsufficientReserve();

        totalFeesCollected += fee;
        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            if (!feeOk) revert TransferFailed();
        }

        emit Deposited(batchId, msg.sender, required, fee, net);

        for (uint256 i = 0; i < n; i++) {
            bytes32 payoutId = keccak256(abi.encodePacked(batchId, recipients[i], amounts[i], i));
            if (payoutDone[payoutId]) revert AlreadyPaid();
            payoutDone[payoutId] = true;
            (bool ok, ) = recipients[i].call{value: amounts[i]}("");
            if (!ok) revert TransferFailed();
            emit Paid(batchId, payoutId, recipients[i], amounts[i]);
        }

        uint256 dust = msg.value - required;
        if (dust > 0) {
            (bool refundOk, ) = msg.sender.call{value: dust}("");
            if (!refundOk) revert TransferFailed();
        }
    }

    /**
     * @notice A deposits ETH for a private payout batch. Gross = net + fee.
     * @param batchId Off-chain / client-generated id linking recipients (stored in API).
     * @param netAmount Total that will be paid out to recipients (sum of payouts).
     */
    function deposit(bytes32 batchId, uint256 netAmount) external payable nonReentrant {
        if (batchId == bytes32(0)) revert ZeroValue();
        if (netAmount == 0) revert ZeroValue();
        uint256 fee = (netAmount * uint256(feeBps)) / 10_000;
        uint256 required = netAmount + fee;
        if (msg.value < required) revert InsufficientReserve();

        batchReserved[batchId] += netAmount;
        totalReserved += netAmount;
        totalFeesCollected += fee;

        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            if (!feeOk) revert TransferFailed();
        }

        // Refund dust above required
        uint256 dust = msg.value - required;
        if (dust > 0) {
            (bool refundOk, ) = msg.sender.call{value: dust}("");
            if (!refundOk) revert TransferFailed();
        }

        emit Deposited(batchId, msg.sender, required, fee, netAmount);
    }

    /**
     * @notice Operator pays one recipient from a batch reserve (Vault → B).
     * Separate tx from deposit so receive-leg is from vault, not A.
     */
    function payout(
        bytes32 batchId,
        bytes32 payoutId,
        address recipient,
        uint256 amount
    ) external onlyOperator nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroValue();
        if (payoutDone[payoutId]) revert AlreadyPaid();
        if (batchReserved[batchId] < amount) revert InsufficientReserve();

        payoutDone[payoutId] = true;
        batchReserved[batchId] -= amount;
        totalReserved -= amount;

        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Paid(batchId, payoutId, recipient, amount);
    }

    /**
     * @notice Operator multi-payout in one tx (still from vault; recipients don't see A).
     */
    function payoutMany(
        bytes32 batchId,
        bytes32[] calldata payoutIds,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOperator nonReentrant {
        uint256 n = payoutIds.length;
        if (n != recipients.length || n != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            total += amounts[i];
        }
        if (batchReserved[batchId] < total) revert InsufficientReserve();

        batchReserved[batchId] -= total;
        totalReserved -= total;

        for (uint256 i = 0; i < n; i++) {
            bytes32 pid = payoutIds[i];
            address to = recipients[i];
            uint256 amt = amounts[i];
            if (to == address(0)) revert ZeroAddress();
            if (amt == 0) revert ZeroValue();
            if (payoutDone[pid]) revert AlreadyPaid();
            payoutDone[pid] = true;

            (bool ok, ) = to.call{value: amt}("");
            if (!ok) revert TransferFailed();
            emit Paid(batchId, pid, to, amt);
        }
    }

    /// @notice Available liquid ETH not reserved for batches
    function freeBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        if (bal <= totalReserved) return 0;
        return bal - totalReserved;
    }

    /// @notice Owner can sweep unreserved dust (not batch reserves)
    function sweepFree(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > freeBalance()) revert InsufficientReserve();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Sweep(to, amount);
    }

    receive() external payable {}
}
