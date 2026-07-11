const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SilentPrivateSend", function () {
  let messenger, privateSend, owner, sender, stealth;

  beforeEach(async function () {
    [owner, sender, stealth] = await ethers.getSigners();
    const Messenger = await ethers.getContractFactory("ERC5564Messenger");
    messenger = await Messenger.deploy(owner.address);
    await messenger.waitForDeployment();

    const PrivateSend = await ethers.getContractFactory("SilentPrivateSend");
    privateSend = await PrivateSend.deploy(await messenger.getAddress());
    await privateSend.waitForDeployment();
  });

  it("funds stealth and emits announce + PrivateSend", async function () {
    const eph = ethers.hexlify(ethers.randomBytes(65));
    const meta = ethers.hexlify(ethers.toUtf8Bytes("silent"));
    const value = ethers.parseEther("0.05");

    const before = await ethers.provider.getBalance(stealth.address);

    const tx = await privateSend
      .connect(sender)
      .sendEth(stealth.address, eph, meta, { value });

    await expect(tx)
      .to.emit(privateSend, "PrivateSend")
      .withArgs(sender.address, stealth.address, value, eph);

    await expect(tx).to.emit(messenger, "Announcement");

    const after = await ethers.provider.getBalance(stealth.address);
    expect(after - before).to.equal(value);
  });

  it("rejects zero value", async function () {
    const eph = ethers.hexlify(ethers.randomBytes(65));
    await expect(
      privateSend.connect(sender).sendEth(stealth.address, eph, "0x", { value: 0 })
    ).to.be.revertedWithCustomError(privateSend, "ZeroValue");
  });

  it("rejects empty ephemeral key", async function () {
    await expect(
      privateSend
        .connect(sender)
        .sendEth(stealth.address, "0x", "0x", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(privateSend, "EmptyKey");
  });
});
