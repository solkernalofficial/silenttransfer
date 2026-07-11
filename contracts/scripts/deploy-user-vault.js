/**
 * Deploy SilentUserVault — wallet-bound private balance (no notes).
 *   npx hardhat run scripts/deploy-user-vault.js --network robinhoodTestnet
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const feeBps = Number(process.env.VAULT_FEE_BPS || 50);
  const feeRecipient = process.env.VAULT_FEE_RECIPIENT || deployer.address;

  console.log("Deployer", deployer.address, "feeBps", feeBps);
  const F = await hre.ethers.getContractFactory("SilentUserVault");
  const vault = await F.deploy(deployer.address, feeRecipient, feeBps);
  await vault.waitForDeployment();
  const addr = await vault.getAddress();
  console.log("SilentUserVault", addr);

  const out = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    SilentUserVault: addr,
    feeBps,
    feeRecipient,
    model: "wallet-bound balance; deposit then withdraw anytime to any wallets",
    noLocalNotes: true,
    recipientClaim: false,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hre.network.name}.user-vault.json`), JSON.stringify(out, null, 2));
  console.log("NEXT_PUBLIC_USER_VAULT_ADDRESS=" + addr);
  console.log("USER_VAULT_ADDRESS=" + addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
