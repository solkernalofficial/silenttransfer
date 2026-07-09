const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC6538Registry", function () {
  let registry, owner, oracle, user1, user2;

  beforeEach(async function () {
    [owner, oracle, user1, user2] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ERC6538Registry");
    registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
  });

  it("should set initial owner and compliance oracle", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.complianceOracle()).to.equal(owner.address);
  });

  it("should reject zero address owner", async function () {
    const Registry = await ethers.getContractFactory("ERC6538Registry");
    await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      Registry, "OwnableInvalidOwner"
    );
  });

  it("should register keys", async function () {
    const spendKey = ethers.hexlify(ethers.randomBytes(64));
    const viewKey = ethers.hexlify(ethers.randomBytes(64));
    const tx = await registry.connect(user1).registerKeys(spendKey, viewKey);
    await expect(tx).to.emit(registry, "StealthMetaAddressRegistered");
    expect(await registry.isRegistered(user1.address)).to.be.true;
  });

  it("should reject invalid key lengths", async function () {
    const shortKey = ethers.hexlify(ethers.randomBytes(32));
    const validKey = ethers.hexlify(ethers.randomBytes(64));
    await expect(
      registry.connect(user1).registerKeys(shortKey, validKey)
    ).to.be.revertedWithCustomError(registry, "InvalidKeyLength");
  });

  it("should update keys", async function () {
    const spendKey1 = ethers.hexlify(ethers.randomBytes(64));
    const viewKey1 = ethers.hexlify(ethers.randomBytes(64));
    await registry.connect(user1).registerKeys(spendKey1, viewKey1);

    const spendKey2 = ethers.hexlify(ethers.randomBytes(64));
    const viewKey2 = ethers.hexlify(ethers.randomBytes(64));
    await expect(registry.connect(user1).updateKeys(spendKey2, viewKey2))
      .to.emit(registry, "StealthMetaAddressUpdated");
  });

  it("should reject update for unregistered user", async function () {
    const key = ethers.hexlify(ethers.randomBytes(64));
    await expect(
      registry.connect(user1).updateKeys(key, key)
    ).to.be.revertedWithCustomError(registry, "AddressNotRegistered");
  });

  it("should clear keys", async function () {
    const spendKey = ethers.hexlify(ethers.randomBytes(64));
    const viewKey = ethers.hexlify(ethers.randomBytes(64));
    await registry.connect(user1).registerKeys(spendKey, viewKey);
    await expect(registry.connect(user1).clearKeys())
      .to.emit(registry, "StealthMetaAddressCleared");
    expect(await registry.isRegistered(user1.address)).to.be.false;
  });

  it("should manage KYC status through oracle", async function () {
    await registry.connect(owner).setKYCStatus(user1.address, true);
    expect(await registry.isKYCCompliant(user1.address)).to.be.true;
    await registry.connect(owner).setKYCStatus(user1.address, false);
    expect(await registry.isKYCCompliant(user1.address)).to.be.false;
  });

  it("should reject KYC from non-oracle", async function () {
    await expect(
      registry.connect(user1).setKYCStatus(user2.address, true)
    ).to.be.revertedWith("Caller is not the compliance oracle");
  });

  it("should update compliance oracle", async function () {
    await expect(registry.connect(owner).updateComplianceOracle(oracle.address))
      .to.emit(registry, "ComplianceOracleUpdated");
    expect(await registry.complianceOracle()).to.equal(oracle.address);
  });

  it("should get stealth meta address", async function () {
    const spendKey = ethers.hexlify(ethers.randomBytes(64));
    const viewKey = ethers.hexlify(ethers.randomBytes(64));
    await registry.connect(user1).registerKeys(spendKey, viewKey);
    const [spend, view] = await registry.getStealthMetaAddress(user1.address);
    expect(spend).to.equal(spendKey);
    expect(view).to.equal(viewKey);
  });
});

describe("ERC5564Messenger", function () {
  let messenger, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const Messenger = await ethers.getContractFactory("ERC5564Messenger");
    messenger = await Messenger.deploy(owner.address);
    await messenger.waitForDeployment();
  });

  it("should emit Announcement event", async function () {
    const schemeId = 1;
    const stealthAddr = ethers.Wallet.createRandom().address;
    const ephKey = ethers.hexlify(ethers.randomBytes(32));
    const meta = ethers.toUtf8Bytes('{"token":"AAPL","amount":"1.5"}');
    await expect(messenger.connect(user).announce(schemeId, stealthAddr, ephKey, meta))
      .to.emit(messenger, "Announcement")
      .withArgs(schemeId, stealthAddr, user.address, ephKey, meta);
  });

  it("should reject zero address", async function () {
    await expect(
      messenger.connect(user).announce(1, ethers.ZeroAddress, "0x00", "0x00")
    ).to.be.revertedWithCustomError(messenger, "ZeroAddress");
  });
});

describe("MockComplianceOracle", function () {
  let oracle, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("MockComplianceOracle");
    oracle = await Oracle.deploy(owner.address);
    await oracle.waitForDeployment();
  });

  it("should whitelist and remove addresses", async function () {
    await oracle.connect(owner).whitelistAddress(user.address);
    expect(await oracle.isWhitelisted(user.address)).to.be.true;
    await oracle.connect(owner).removeAddress(user.address);
    expect(await oracle.isWhitelisted(user.address)).to.be.false;
  });
});

describe("MockStockToken", function () {
  let token, owner, user, whitelisted;

  beforeEach(async function () {
    [owner, user, whitelisted] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockStockToken");
    token = await Token.deploy("Apple Stock", "AAPL", owner.address);
    await token.waitForDeployment();
    await token.setWhitelistStatus(whitelisted.address, true);
  });

  it("should mint and transfer to whitelisted", async function () {
    await token.connect(owner).mint(owner.address, ethers.parseEther("1000"));
    await token.connect(owner).transfer(whitelisted.address, ethers.parseEther("100"));
    expect(await token.balanceOf(whitelisted.address)).to.equal(ethers.parseEther("100"));
  });

  it("should reject transfer to non-whitelisted", async function () {
    await token.connect(owner).mint(owner.address, ethers.parseEther("1000"));
    await expect(
      token.connect(owner).transfer(user.address, ethers.parseEther("100"))
    ).to.be.revertedWithCustomError(token, "NotWhitelisted");
  });
});

describe("SilentPaymaster", function () {
  let paymaster, owner, collector, user;

  beforeEach(async function () {
    [owner, collector, user] = await ethers.getSigners();
    const Paymaster = await ethers.getContractFactory("SilentPaymaster");
    paymaster = await Paymaster.deploy(collector.address, owner.address);
    await paymaster.waitForDeployment();
  });

  it("should calculate fee correctly (0% default)", async function () {
    const amount = ethers.parseEther("1000");
    const fee = await paymaster.validateAndSponsor(
      user.address, ethers.ZeroAddress, ethers.ZeroAddress, amount, 150000
    );
    expect(fee).to.equal(0n);
  });

  it("should apply 0.5% when fee bps set to 50", async function () {
    await paymaster.connect(owner).setFeeBasisPoints(50);
    const amount = ethers.parseEther("1000");
    const fee = await paymaster.validateAndSponsor(
      user.address, ethers.ZeroAddress, ethers.ZeroAddress, amount, 150000
    );
    // 0.5% of 1000 = 5
    expect(fee).to.equal(ethers.parseEther("5"));
  });

  it("should allow owner to update fee", async function () {
    await paymaster.connect(owner).setFeeBasisPoints(200);
    expect(await paymaster.feeBasisPoints()).to.equal(200);
  });

  it("should pause and unpause", async function () {
    await paymaster.connect(owner).pause();
    expect(await paymaster.paused()).to.be.true;
    await paymaster.connect(owner).unpause();
    expect(await paymaster.paused()).to.be.false;
  });
});
