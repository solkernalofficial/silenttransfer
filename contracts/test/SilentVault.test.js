const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SilentVault", function () {
  let vault, owner, feeSink, alice, bob, carol;
  const feeBps = 50; // 0.5%

  beforeEach(async function () {
    [owner, feeSink, alice, bob, carol] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("SilentVault");
    vault = await Vault.deploy(owner.address, feeSink.address, feeBps);
    await vault.waitForDeployment();
  });

  function batchId(s) {
    return ethers.id(s);
  }

  it("charges A gross = net + fee and reserves net", async function () {
    const net = ethers.parseEther("1.0");
    const fee = (net * BigInt(feeBps)) / 10000n;
    const gross = net + fee;
    const id = batchId("batch-1");

    const feeBefore = await ethers.provider.getBalance(feeSink.address);
    await expect(vault.connect(alice).deposit(id, net, { value: gross }))
      .to.emit(vault, "Deposited")
      .withArgs(id, alice.address, gross, fee, net);

    expect(await vault.batchReserved(id)).to.equal(net);
    const feeAfter = await ethers.provider.getBalance(feeSink.address);
    expect(feeAfter - feeBefore).to.equal(fee);
  });

  it("pays B from vault so receive leg is not from Alice", async function () {
    const net = ethers.parseEther("0.5");
    const fee = (net * BigInt(feeBps)) / 10000n;
    const id = batchId("batch-2");
    await vault.connect(alice).deposit(id, net, { value: net + fee });

    const bobBefore = await ethers.provider.getBalance(bob.address);
    const payoutId = ethers.id("payout-bob");
    await expect(vault.connect(owner).payout(id, payoutId, bob.address, net))
      .to.emit(vault, "Paid")
      .withArgs(id, payoutId, bob.address, net);

    const bobAfter = await ethers.provider.getBalance(bob.address);
    expect(bobAfter - bobBefore).to.equal(net);
    expect(await vault.batchReserved(id)).to.equal(0);
  });

  it("batch pays B and C", async function () {
    const a1 = ethers.parseEther("0.2");
    const a2 = ethers.parseEther("0.3");
    const net = a1 + a2;
    const fee = (net * BigInt(feeBps)) / 10000n;
    const id = batchId("batch-3");
    await vault.connect(alice).deposit(id, net, { value: net + fee });

    await vault.connect(owner).payoutMany(
      id,
      [ethers.id("p1"), ethers.id("p2")],
      [bob.address, carol.address],
      [a1, a2]
    );
    expect(await vault.batchReserved(id)).to.equal(0);
  });

  it("privateSend pays B immediately in one tx (no claim)", async function () {
    const amt = ethers.parseEther("0.05");
    const fee = (amt * BigInt(feeBps)) / 10000n;
    const id = batchId("instant-1");
    const bobBefore = await ethers.provider.getBalance(bob.address);

    await expect(
      vault.connect(alice).privateSend(id, [bob.address], [amt], { value: amt + fee })
    )
      .to.emit(vault, "Deposited")
      .and.to.emit(vault, "Paid");

    const bobAfter = await ethers.provider.getBalance(bob.address);
    expect(bobAfter - bobBefore).to.equal(amt);
  });

  it("privateSend batch pays B and C in one tx", async function () {
    const a1 = ethers.parseEther("0.02");
    const a2 = ethers.parseEther("0.03");
    const net = a1 + a2;
    const fee = (net * BigInt(feeBps)) / 10000n;
    const id = batchId("instant-batch");
    const b0 = await ethers.provider.getBalance(bob.address);
    const c0 = await ethers.provider.getBalance(carol.address);

    await vault
      .connect(alice)
      .privateSend(id, [bob.address, carol.address], [a1, a2], { value: net + fee });

    expect((await ethers.provider.getBalance(bob.address)) - b0).to.equal(a1);
    expect((await ethers.provider.getBalance(carol.address)) - c0).to.equal(a2);
  });

  it("rejects double payout", async function () {
    const net = ethers.parseEther("0.1");
    const fee = (net * BigInt(feeBps)) / 10000n;
    const id = batchId("batch-4");
    await vault.connect(alice).deposit(id, net, { value: net + fee });
    const pid = ethers.id("once");
    await vault.connect(owner).payout(id, pid, bob.address, net);
    await expect(
      vault.connect(owner).payout(id, pid, bob.address, net)
    ).to.be.revertedWithCustomError(vault, "AlreadyPaid");
  });
});
