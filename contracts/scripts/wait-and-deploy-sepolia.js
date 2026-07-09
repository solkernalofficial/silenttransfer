/**
 * Poll Sepolia balance; deploy when deployer has funds.
 * Usage: node scripts/wait-and-deploy-sepolia.js
 */
const { spawn } = require("child_process");
const { ethers } = require("ethers");
require("dotenv").config();

const RPC =
  process.env.SEPOLIA_RPC_URL ||
  process.env.RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const KEY = process.env.DEPLOYER_PRIVATE_KEY;
const INTERVAL_MS = 20000;
const MIN_ETH = 0.01;

async function main() {
  if (!KEY) {
    console.error("DEPLOYER_PRIVATE_KEY missing in contracts/.env");
    process.exit(1);
  }
  const wallet = new ethers.Wallet(KEY);
  const provider = new ethers.JsonRpcProvider(RPC);
  console.log("Waiting for Sepolia funds…");
  console.log("Address:", wallet.address);
  console.log("Faucets:");
  console.log("  https://www.alchemy.com/faucets/ethereum-sepolia");
  console.log("  https://sepolia-faucet.pk910.de/");
  console.log("  https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
  console.log("  https://faucet.quicknode.com/ethereum/sepolia");
  console.log(`Need at least ~${MIN_ETH} ETH. Polling every ${INTERVAL_MS / 1000}s…\n`);

  for (;;) {
    try {
      const bal = await provider.getBalance(wallet.address);
      const eth = Number(ethers.formatEther(bal));
      console.log(new Date().toISOString(), `balance=${eth} ETH`);
      if (eth >= MIN_ETH) {
        console.log("Funds detected — starting deploy…");
        const child = spawn(
          "npx",
          ["hardhat", "run", "scripts/deploy.js", "--network", "sepolia"],
          { stdio: "inherit", shell: true, cwd: __dirname + "/.." }
        );
        child.on("exit", (code) => process.exit(code || 0));
        return;
      }
    } catch (e) {
      console.warn("RPC error:", e.message);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
