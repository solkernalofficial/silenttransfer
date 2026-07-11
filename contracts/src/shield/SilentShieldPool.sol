// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IncrementalMerkleTree.sol";
import "./IShieldVerifier.sol";
import "./TestnetShieldVerifier.sol";

/**
 * @title SilentShieldPool
 * @notice Fixed-denomination shielded pool (Tornado-style).
 *
 * Deposit:  pay `denomination` ETH + post commitment = H(secret, nullifier)
 * Withdraw: prove knowledge of note in Merkle tree; spend nullifier once; send to recipient
 *
 * Privacy:
 *  - Inside the pool, transfers are note-based (unlink deposit leaf from withdraw when using
 *    a true ZK verifier).
 *  - Testnet verifier checks Merkle witness (not ZK-hiding of path) — swap verifier for prod.
 *  - Fixed denomination reduces amount fingerprinting vs arbitrary amounts.
 */
contract SilentShieldPool is IncrementalMerkleTree, ReentrancyGuard, Ownable {
    uint256 public immutable denomination;
    IShieldVerifier public verifier;
    TestnetShieldVerifier public testnetVerifier;
    bool public useTestnetWitness;

    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(
        address indexed to,
        bytes32 nullifierHash,
        address indexed relayer,
        uint256 fee
    );
    event VerifierUpdated(address indexed verifier, bool testnetWitness);

    error InvalidValue();
    error CommitmentExists();
    error UnknownRoot();
    error NullifierUsed();
    error FeeTooHigh();
    error InvalidProof();
    error TransferFailed();
    error ZeroAddress();

    constructor(
        uint32 treeLevels,
        uint256 denomination_,
        address owner_,
        bool testnetMode
    ) IncrementalMerkleTree(treeLevels) Ownable(owner_) {
        if (denomination_ == 0) revert InvalidValue();
        if (owner_ == address(0)) revert ZeroAddress();
        denomination = denomination_;
        useTestnetWitness = testnetMode;
        if (testnetMode) {
            testnetVerifier = new TestnetShieldVerifier(treeLevels);
            verifier = IShieldVerifier(address(testnetVerifier));
        }
        emit VerifierUpdated(address(verifier), testnetMode);
    }

    function setVerifier(address v, bool testnetWitness) external onlyOwner {
        if (v == address(0)) revert ZeroAddress();
        verifier = IShieldVerifier(v);
        useTestnetWitness = testnetWitness;
        if (testnetWitness) {
            testnetVerifier = TestnetShieldVerifier(v);
        }
        emit VerifierUpdated(v, testnetWitness);
    }

    /**
     * @notice Shield `denomination` ETH into the pool under `commitment`.
     */
    function deposit(bytes32 commitment) external payable nonReentrant {
        if (msg.value != denomination) revert InvalidValue();
        if (commitment == bytes32(0)) revert InvalidValue();
        if (commitments[commitment]) revert CommitmentExists();

        commitments[commitment] = true;
        uint32 insertedIndex = _insert(commitment);
        emit Deposit(commitment, insertedIndex, block.timestamp);
    }

    /**
     * @notice Production-style withdraw with Groth16 proof (a,b,c) + public inputs.
     */
    function withdraw(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input,
        address payable recipient
    ) external nonReentrant {
        _withdraw(a, b, c, input, recipient, payable(address(0)), 0, "");
    }

    /**
     * @notice Testnet withdraw with Merkle witness proof blob (not ZK path-hiding).
     * @param input [root, nullifierHash, recipient, relayer, fee]
     * @param witness abi.encode(secret, nullifier, pathElements, pathIndices)
     */
    function withdrawWithWitness(
        uint256[5] calldata input,
        address payable recipient,
        address payable relayer,
        uint256 fee,
        bytes calldata witness
    ) external nonReentrant {
        if (!useTestnetWitness) revert InvalidProof();
        bytes32 root = bytes32(input[0]);
        bytes32 nullifierHash = bytes32(input[1]);
        if (!isKnownRoot(root)) revert UnknownRoot();
        if (nullifierHashes[nullifierHash]) revert NullifierUsed();
        if (fee >= denomination) revert FeeTooHigh();

        // Bind recipient/relayer/fee into public inputs
        if (input[2] != uint256(uint160(address(recipient)))) revert InvalidProof();
        if (input[3] != uint256(uint160(address(relayer)))) revert InvalidProof();
        if (input[4] != fee) revert InvalidProof();

        if (!testnetVerifier.verifyWitness(witness, input)) revert InvalidProof();

        nullifierHashes[nullifierHash] = true;
        _pay(recipient, relayer, fee);
        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }

    function _withdraw(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input,
        address payable recipient,
        address payable relayer,
        uint256 fee,
        bytes memory /* unused */
    ) internal {
        bytes32 root = bytes32(input[0]);
        bytes32 nullifierHash = bytes32(input[1]);
        if (!isKnownRoot(root)) revert UnknownRoot();
        if (nullifierHashes[nullifierHash]) revert NullifierUsed();
        if (fee >= denomination) revert FeeTooHigh();
        if (input[2] != uint256(uint160(address(recipient)))) revert InvalidProof();
        if (input[3] != uint256(uint160(address(relayer)))) revert InvalidProof();
        if (input[4] != fee) revert InvalidProof();

        if (useTestnetWitness) revert InvalidProof(); // must use withdrawWithWitness
        if (!verifier.verifyProof(a, b, c, input)) revert InvalidProof();

        nullifierHashes[nullifierHash] = true;
        _pay(recipient, relayer, fee);
        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }

    function _pay(address payable recipient, address payable relayer, uint256 fee) internal {
        uint256 amount = denomination - fee;
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        if (fee > 0) {
            if (relayer == address(0)) revert ZeroAddress();
            (bool ok2, ) = relayer.call{value: fee}("");
            if (!ok2) revert TransferFailed();
        }
    }

    receive() external payable {}
}
