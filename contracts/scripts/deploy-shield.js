/**
 * Deploy SilentShieldPool (fixed denomination, testnet witness mode).
 *
 * Usage:
 *   npx hardhat run scripts/deploy-shield.js --network robinhoodTestnet
 *
 * Env:
 *   SHIELD_DENOMINATION_ETH=0.1
 *   SHIELD_LEVELS=20
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const levels = Number(process.env.SHIELD_LEVELS || 20);
  const denomEth = process.env.SHIELD_DENOMINATION_ETH || "0.1";
  const denomination = hre.ethers.parseEther(denomEth);

  console.log("Deployer", deployer.address);
  console.log("Levels", levels, "Denomination", denomEth, "ETH");

  const Pool = await hre.ethers.getContractFactory("SilentShieldPool");
  const pool = await Pool.deploy(levels, denomination, deployer.address, true);
  await pool.waitForDeployment();
  const addr = await pool.getAddress();
  console.log("SilentShieldPool", addr);

  const out = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    SilentShieldPool: addr,
    levels,
    denominationWei: denomination.toString(),
    denominationEth: denomEth,
    testnetWitness: true,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${hre.network.name}.shield.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Wrote", file);

  console.log("\nSet env:");
  console.log(`NEXT_PUBLIC_SHIELD_POOL_ADDRESS=${addr}`);
  console.log(`SHIELD_POOL_ADDRESS=${addr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
