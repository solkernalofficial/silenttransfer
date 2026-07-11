// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IShieldVerifier.sol";

/**
 * @title TestnetShieldVerifier
 * @notice Testnet verifier that checks a **Merkle membership + note preimage** proof
 *         encoded in the proof payload, without a full trusted-setup ceremony.
 *
 * Proof layout (abi.encode):
 *   bytes32 secret
 *   bytes32 nullifier
 *   bytes32[] pathElements  // length = levels
 *   uint8[] pathIndices     // 0 = left, 1 = right
 *
 * Public inputs (input[0..4]):
 *   0: root
 *   1: nullifierHash   = keccak256(nullifier)
 *   2: recipient (uint160 cast)
 *   3: relayer (uint160 cast)
 *   4: fee
 *
 * Commitment = keccak256(secret, nullifier) must sit in Merkle tree at `root`.
 *
 * HONEST LIMIT:
 *  - This is **not** a production Groth16 SNARK. Path is verified on-chain in this
 *    testnet verifier (the proof blob is not zero-knowledge w.r.t. the chain).
 *  - Production must replace with a true Groth16/PLONK Verifier.sol from a ceremony
 *    so the leaf index never appears on-chain.
 *  - Still useful: nullifiers prevent double-spend; fixed denomination; pool UX;
 *    API/frontend note flow matches real ZK shielded pools.
 */
contract TestnetShieldVerifier is IShieldVerifier {
    uint32 public immutable levels;

    error BadProof();
    error BadLevels();

    constructor(uint32 levels_) {
        if (levels_ == 0 || levels_ > 32) revert BadLevels();
        levels = levels_;
    }

    function verifyProof(
        uint256[2] calldata /* a */,
        uint256[2][2] calldata /* b */,
        uint256[2] calldata /* c */,
        uint256[5] calldata input
    ) external view override returns (bool) {
        // For interface compatibility a/b/c are ignored on testnet.
        // Real Groth16 verifier uses them; we decode path from tx calldata trailing bytes
        // is NOT available here — so TestnetShieldVerifier is only used via
        // SilentShieldPool.withdrawWithWitness for testnet.
        // This function returns false if called without witness path.
        // SilentShieldPool will call verifyWitness instead on testnet.
        input;
        return false;
    }

    function verifyWitness(
        bytes calldata witness,
        uint256[5] calldata input
    ) external view returns (bool) {
        (
            bytes32 secret,
            bytes32 nullifier,
            bytes32[] memory pathElements,
            uint8[] memory pathIndices
        ) = abi.decode(witness, (bytes32, bytes32, bytes32[], uint8[]));

        if (pathElements.length != levels || pathIndices.length != levels) revert BadProof();

        bytes32 nullifierHash = keccak256(abi.encodePacked(nullifier));
        if (uint256(nullifierHash) != input[1]) return false;

        bytes32 commitment = keccak256(abi.encodePacked(secret, nullifier));
        bytes32 node = commitment;
        for (uint32 i = 0; i < levels; i++) {
            bytes32 sibling = pathElements[i];
            if (pathIndices[i] == 0) {
                node = keccak256(abi.encodePacked(node, sibling));
            } else {
                node = keccak256(abi.encodePacked(sibling, node));
            }
        }
        if (uint256(node) != input[0]) return false;
        return true;
    }
}
