// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IncrementalMerkleTree
 * @notice Fixed-depth append-only Merkle tree (Tornado-style).
 * @dev Uses keccak256 for EVM-native hashing. Circuit / prover must use the same
 *      hash for testnet proofs. Production ZK often switches to Poseidon via precompile.
 */
abstract contract IncrementalMerkleTree {
    uint32 public immutable levels;
    uint32 public nextIndex;
    bytes32 public currentRoot;

    mapping(uint256 => bytes32) public filledSubtrees;
    mapping(uint256 => bytes32) public roots;
    uint32 public currentRootIndex;
    uint32 public constant ROOT_HISTORY_SIZE = 30;

    bytes32[] public zeros;

    event RootUpdated(bytes32 root, uint32 index);

    error TreeFull();
    error InvalidLevels();

    constructor(uint32 _levels) {
        if (_levels == 0 || _levels > 32) revert InvalidLevels();
        levels = _levels;

        // zero hashes: zeros[i] = hash(zeros[i-1], zeros[i-1])
        bytes32 z = bytes32(0);
        zeros = new bytes32[](_levels);
        for (uint32 i = 0; i < _levels; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = keccak256(abi.encodePacked(z, z));
        }
        currentRoot = z;
        roots[0] = z;
    }

    function hashLeftRight(bytes32 left, bytes32 right) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }

    function _insert(bytes32 leaf) internal returns (uint32 index) {
        index = nextIndex;
        if (index >= uint32(2) ** levels) revert TreeFull();

        uint32 currentIndex = index;
        bytes32 currentLevelHash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint32 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(left, right);
            currentIndex /= 2;
        }

        currentRoot = currentLevelHash;
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentRoot;
        nextIndex = index + 1;
        emit RootUpdated(currentRoot, index);
    }

    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint32 i = currentRootIndex;
        for (uint32 k = 0; k < ROOT_HISTORY_SIZE; k++) {
            if (root == roots[i]) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE - 1;
            else i--;
        }
        return false;
    }
}
