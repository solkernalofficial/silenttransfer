const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMerkleTree, createNote, publicInput, encodeWitness } = require("./helpers/shieldNotes");

describe("SilentShieldPool", function () {
  const LEVELS = 4; // small tree for tests
  const DENOM = ethers.parseEther("0.1");
  let pool, owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Pool = await ethers.getContractFactory("SilentShieldPool");
    pool = await Pool.deploy(LEVELS, DENOM, owner.address, true);
    await pool.waitForDeployment();
  });

  it("deposits and withdraws with Merkle witness (testnet verifier)", async function () {
    const note = createNote();
    await expect(pool.connect(alice).deposit(note.commitment, { value: DENOM }))
      .to.emit(pool, "Deposit");

    // Build tree from single leaf (same as on-chain insert order)
    const tree = buildMerkleTree(LEVELS, [note.commitment]);
    const { pathElements, pathIndices } = tree.path(0);
    const root = tree.root;

    expect(await pool.isKnownRoot(root)).to.equal(true);

    const input = publicInput({
      root,
      nullifierHash: note.nullifierHash,
      recipient: bob.address,
      relayer: ethers.ZeroAddress,
      fee: 0n,
    });
    const witness = encodeWitness(note.secret, note.nullifier, pathElements, pathIndices);

    const bobBefore = await ethers.provider.getBalance(bob.address);
    await expect(
      pool.connect(alice).withdrawWithWitness(input, bob.address, ethers.ZeroAddress, 0, witness)
    )
      .to.emit(pool, "Withdrawal")
      .withArgs(bob.address, note.nullifierHash, ethers.ZeroAddress, 0);

    const bobAfter = await ethers.provider.getBalance(bob.address);
    expect(bobAfter - bobBefore).to.equal(DENOM);

    // double spend blocked
    await expect(
      pool.connect(alice).withdrawWithWitness(input, bob.address, ethers.ZeroAddress, 0, witness)
    ).to.be.revertedWithCustomError(pool, "NullifierUsed");
  });

  it("rejects wrong denomination", async function () {
    const note = createNote();
    await expect(
      pool.connect(alice).deposit(note.commitment, { value: ethers.parseEther("0.05") })
    ).to.be.revertedWithCustomError(pool, "InvalidValue");
  });

  it("two deposits — withdraw second note", async function () {
    const n1 = createNote();
    const n2 = createNote();
    await pool.connect(alice).deposit(n1.commitment, { value: DENOM });
    await pool.connect(alice).deposit(n2.commitment, { value: DENOM });

    const tree = buildMerkleTree(LEVELS, [n1.commitment, n2.commitment]);
    const { pathElements, pathIndices } = tree.path(1);
    const input = publicInput({
      root: tree.root,
      nullifierHash: n2.nullifierHash,
      recipient: bob.address,
      relayer: ethers.ZeroAddress,
      fee: 0n,
    });
    const witness = encodeWitness(n2.secret, n2.nullifier, pathElements, pathIndices);
    await pool.withdrawWithWitness(input, bob.address, ethers.ZeroAddress, 0, witness);
    expect(await pool.nullifierHashes(n2.nullifierHash)).to.equal(true);
  });
});
