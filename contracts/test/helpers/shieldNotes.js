const { ethers } = require("hardhat");

function hashLeftRight(left, right) {
  return ethers.keccak256(
    ethers.concat([ethers.getBytes(left), ethers.getBytes(right)])
  );
}

function createNote() {
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const nullifier = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.keccak256(ethers.concat([secret, nullifier]));
  const nullifierHash = ethers.keccak256(nullifier);
  return { secret, nullifier, commitment, nullifierHash };
}

function zeroHashes(levels) {
  const z = [ethers.ZeroHash];
  for (let i = 0; i < levels; i++) {
    z.push(hashLeftRight(z[i], z[i]));
  }
  return z;
}

/**
 * Path + root matching IncrementalMerkleTree left-to-right insert
 * (full tree of size 2^levels, unused leaves = zero).
 */
function buildMerkleTree(levels, leaves) {
  const z = zeroHashes(levels);
  const size = 2 ** levels;
  const layer0 = Array(size).fill(z[0]);
  for (let i = 0; i < leaves.length; i++) {
    layer0[i] = leaves[i];
  }

  function path(index) {
    const pathElements = [];
    const pathIndices = [];
    let idx = index;
    let layer = layer0.slice();
    for (let lvl = 0; lvl < levels; lvl++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      pathElements.push(layer[siblingIdx] ?? z[lvl]);
      pathIndices.push(idx % 2);
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i] ?? z[lvl];
        const right = layer[i + 1] ?? z[lvl];
        next.push(hashLeftRight(left, right));
      }
      layer = next;
      idx = Math.floor(idx / 2);
    }
    return { pathElements, pathIndices, root: layer[0] };
  }

  const root = leaves.length === 0 ? z[levels] : path(0).root;
  // recompute root from top of full tree
  let layer = layer0.slice();
  for (let lvl = 0; lvl < levels; lvl++) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hashLeftRight(layer[i], layer[i + 1]));
    }
    layer = next;
  }

  return {
    root: layer[0],
    path: (index) => {
      const p = path(index);
      return { pathElements: p.pathElements, pathIndices: p.pathIndices };
    },
  };
}

function publicInput({ root, nullifierHash, recipient, relayer, fee }) {
  return [
    BigInt(root),
    BigInt(nullifierHash),
    BigInt(recipient),
    BigInt(relayer),
    BigInt(fee),
  ];
}

function encodeWitness(secret, nullifier, pathElements, pathIndices) {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  return abi.encode(
    ["bytes32", "bytes32", "bytes32[]", "uint8[]"],
    [secret, nullifier, pathElements, pathIndices]
  );
}

module.exports = {
  createNote,
  buildMerkleTree,
  publicInput,
  encodeWitness,
  hashLeftRight,
  zeroHashes,
};
