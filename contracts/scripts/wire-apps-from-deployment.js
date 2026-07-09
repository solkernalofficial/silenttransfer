/**
 * Merge deployment addresses into apps/api/.env and apps/web/.env.local
 * Usage: node scripts/wire-apps-from-deployment.js robinhoodTestnet
 */
const fs = require("fs");
const path = require("path");

const network = process.argv[2] || "robinhoodTestnet";
const root = path.join(__dirname, "..", "..");
const depFile = path.join(__dirname, "..", "deployments", `${network}.json`);

if (!fs.existsSync(depFile)) {
  console.error("Missing", depFile, "— deploy first.");
  process.exit(1);
}

const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));
const rpcDefaults = {
  robinhoodTestnet: "https://rpc.testnet.chain.robinhood.com",
  hoodiTestnet: "https://rpc.testnet.chain.robinhood.com",
  robinhoodMainnet: "https://rpc.mainnet.chain.robinhood.com",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  hardhat: "http://127.0.0.1:8545",
};
const rpc =
  process.env.RH_TESTNET_RPC_URL ||
  process.env.RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  rpcDefaults[network] ||
  "https://rpc.testnet.chain.robinhood.com";

const c = dep.contracts || {};
const silent =
  c.silent ||
  (Array.isArray(c.tokens) &&
    c.tokens.find((t) => t.symbol === "SILENT")?.address) ||
  "";

function upsertEnv(filePath, pairs) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = text.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) map.set(line.slice(0, i), line.slice(i + 1));
  }
  for (const [k, v] of Object.entries(pairs)) {
    if (v === undefined || v === null || v === "") continue;
    map.set(k, String(v));
  }
  const out =
    Array.from(map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out);
  console.log("Updated", filePath);
}

const apiEnv = path.join(root, "apps", "api", ".env");
upsertEnv(apiEnv, {
  CHAIN_ID: dep.chainId,
  RPC_URL: rpc,
  REGISTRY_CONTRACT_ADDRESS: c.registry,
  MESSENGER_CONTRACT_ADDRESS: c.messenger,
  PAYMASTER_CONTRACT_ADDRESS: c.paymaster,
  SILENT_TOKEN_ADDRESS: silent,
  PROTOCOL_FEE_BPS: c.protocolFeeBps || 100,
  DEMO_MODE: "true",
});

const webEnv = path.join(root, "apps", "web", ".env.local");
upsertEnv(webEnv, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001",
  NEXT_PUBLIC_DEMO_MODE: "true",
  NEXT_PUBLIC_CHAIN_ID: dep.chainId,
  NEXT_PUBLIC_RPC_URL: rpc,
  NEXT_PUBLIC_REGISTRY_ADDRESS: c.registry,
  NEXT_PUBLIC_MESSENGER_ADDRESS: c.messenger,
  NEXT_PUBLIC_SILENT_ADDRESS: silent,
  NEXT_PUBLIC_PROTOCOL_FEE_BPS: c.protocolFeeBps || 100,
  NEXT_PUBLIC_SITE_URL: "https://silenttransfer.com",
  NEXT_PUBLIC_SIWE_DOMAIN: "localhost:3000",
  NEXT_PUBLIC_SIWE_URI: "http://localhost:3000",
});

console.log("Wired apps to", network, "— SilentTransfer");
console.log("Registry:", c.registry);
console.log("Messenger:", c.messenger);
console.log("Paymaster:", c.paymaster);
console.log("SILENT:", silent || "(not in deployment)");
