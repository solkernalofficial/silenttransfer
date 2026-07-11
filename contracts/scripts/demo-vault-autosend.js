/**
 * Demo: one-tx privateSend — B receives in wallet, no claim.
 *   npx hardhat run scripts/demo-vault-autosend.js --network robinhoodTestnet
 */
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const VAULT = process.env.VAULT_CONTRACT_ADDRESS || "0x3268fd84bCefB58ae84D6a7B17b15b76f87CBE99";
const AMOUNT = process.env.DEMO_AMOUNT_ETH || "0.0002";

const ABI = [
  "function privateSend(bytes32 batchId, address[] recipients, uint256[] amounts) payable",
  "function feeBps() view returns (uint16)",
];

async function main() {
  const [alice] = await hre.ethers.getSigners();
  const bob = hre.ethers.Wallet.createRandom().address;
  const carol = hre.ethers.Wallet.createRandom().address;

  const vault = new hre.ethers.Contract(VAULT, ABI, alice);
  const feeBps = Number(await vault.feeBps());
  const a1 = hre.ethers.parseEther(AMOUNT);
  const a2 = hre.ethers.parseEther(AMOUNT);
  const net = a1 + a2;
  const fee = (net * BigInt(feeBps)) / 10000n;
  const gross = net + fee;
  const batchId = hre.ethers.id(`demo-auto-${Date.now()}`);

  console.log("Vault", VAULT);
  console.log("A", alice.address);
  console.log("B", bob);
  console.log("C", carol);
  console.log("Each", AMOUNT, "ETH · fee bps", feeBps, "· gross", hre.ethers.formatEther(gross));

  const balB0 = await hre.ethers.provider.getBalance(bob);
  const balC0 = await hre.ethers.provider.getBalance(carol);

  const tx = await vault.privateSend(batchId, [bob, carol], [a1, a2], { value: gross });
  console.log("tx", tx.hash);
  const rec = await tx.wait(1);
  console.log("status", rec.status, "block", rec.blockNumber);

  const balB1 = await hre.ethers.provider.getBalance(bob);
  const balC1 = await hre.ethers.provider.getBalance(carol);
  console.log("B received", hre.ethers.formatEther(balB1 - balB0), "ETH (auto, no claim)");
  console.log("C received", hre.ethers.formatEther(balC1 - balC0), "ETH (auto, no claim)");

  const out = {
    vault: VAULT,
    tx: tx.hash,
    batchId,
    recipients: [
      { address: bob, amount: AMOUNT, received: hre.ethers.formatEther(balB1 - balB0) },
      { address: carol, amount: AMOUNT, received: hre.ethers.formatEther(balC1 - balC0) },
    ],
    autoClaim: false,
    note: "Recipients got ETH in wallet without visiting website",
    at: new Date().toISOString(),
  };
  const f = path.join(__dirname, "..", "deployments", `demo-vault-auto-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log("Wrote", f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
