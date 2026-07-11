/**
 * Deploy SilentVault for auto private send (A pays → B receives in wallet, no claim).
 *
 *   npx hardhat run scripts/deploy-vault.js --network robinhoodTestnet
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const feeBps = Number(process.env.VAULT_FEE_BPS || 50);
  const feeRecipient = process.env.VAULT_FEE_RECIPIENT || deployer.address;

  console.log("Deployer", deployer.address);
  console.log("Fee bps", feeBps, "feeRecipient", feeRecipient);

  const Vault = await hre.ethers.getContractFactory("SilentVault");
  const vault = await Vault.deploy(deployer.address, feeRecipient, feeBps);
  await vault.waitForDeployment();
  const addr = await vault.getAddress();
  console.log("SilentVault", addr);

  const out = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    SilentVault: addr,
    feeBps,
    feeRecipient,
    operator: deployer.address,
    autoPayout: "privateSend (one-tx A→vault→B)",
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${hre.network.name}.vault.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(dir, `${hre.network.name}.vault.env`),
    `VAULT_CONTRACT_ADDRESS=${addr}\nNEXT_PUBLIC_VAULT_ADDRESS=${addr}\n`
  );
  console.log("Wrote", file);
  console.log("\nSet:");
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${addr}`);
  console.log(`VAULT_CONTRACT_ADDRESS=${addr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
