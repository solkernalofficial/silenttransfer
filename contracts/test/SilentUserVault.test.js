const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SilentUserVault", function () {
  let vault, owner, feeSink, alice, bob, carol;
  const feeBps = 50;

  beforeEach(async function () {
    [owner, feeSink, alice, bob, carol] = await ethers.getSigners();
    const V = await ethers.getContractFactory("SilentUserVault");
    vault = await V.deploy(owner.address, feeSink.address, feeBps);
    await vault.waitForDeployment();
  });

  it("deposit credits wallet balance after fee", async function () {
    const gross = ethers.parseEther("1.0");
    const fee = (gross * BigInt(feeBps)) / 10000n;
    const credited = gross - fee;
    await vault.connect(alice).deposit({ value: gross });
    expect(await vault.balanceOf(alice.address)).to.equal(credited);
  });

  it("withdraw sends to B from vault (B no claim)", async function () {
    const gross = ethers.parseEther("0.5");
    await vault.connect(alice).deposit({ value: gross });
    const credit = await vault.balanceOf(alice.address);
    const sendAmt = credit / 2n;

    const b0 = await ethers.provider.getBalance(bob.address);
    await vault.connect(alice).withdraw(bob.address, sendAmt);
    const b1 = await ethers.provider.getBalance(bob.address);
    expect(b1 - b0).to.equal(sendAmt);
    expect(await vault.balanceOf(alice.address)).to.equal(credit - sendAmt);
  });

  it("withdrawMany pays B and C; A can split over time", async function () {
    await vault.connect(alice).deposit({ value: ethers.parseEther("1.0") });
    const a1 = ethers.parseEther("0.1");
    const a2 = ethers.parseEther("0.2");
    const b0 = await ethers.provider.getBalance(bob.address);
    const c0 = await ethers.provider.getBalance(carol.address);

    await vault.connect(alice).withdrawMany([bob.address, carol.address], [a1, a2]);
    expect((await ethers.provider.getBalance(bob.address)) - b0).to.equal(a1);
    expect((await ethers.provider.getBalance(carol.address)) - c0).to.equal(a2);

    // later second withdraw
    await vault.connect(alice).withdraw(bob.address, a1);
  });

  it("rejects over-withdraw", async function () {
    await vault.connect(alice).deposit({ value: ethers.parseEther("0.1") });
    await expect(
      vault.connect(alice).withdraw(bob.address, ethers.parseEther("1.0"))
    ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
  });
});
