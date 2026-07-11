// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Groth16 (or compatible) verifier for shield withdraw proofs.
 * Public signals typically: [root, nullifierHash, recipient, relayer, fee]
 */
interface IShieldVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input
    ) external view returns (bool);
}
