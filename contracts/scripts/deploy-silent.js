/**
 * Deploy only SILENT token and merge into deployments/<network>.json
 *
 *   npx hardhat run scripts/deploy-silent.js --network hardhat
 *   npx hardhat run scripts/deploy-silent.js --network robinhoodTestnet
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 1B total supply plan (community 60% / foundation 35% locked / team 15% / VC 0%)
const INITIAL_MINT = hre.ethers.parseEther("1000000000"); // 1B SILENT

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer. Set DEPLOYER_PRIVATE_KEY for remote networks.");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance));

  if (hre.network.name !== "hardhat" && balance === 0n) {
    throw new Error(`Deployer has 0 native balance on ${hre.network.name}`);
  }

  const Token = await hre.ethers.getContractFactory("SilentToken");
  const token = await Token.deploy(
    "Silent",
    "SILENT",
    18,
    deployer.address,
    INITIAL_MINT
  );
  await token.waitForDeployment();
  const address = await token.getAddress();
  console.log("SILENT deployed:", address);
  console.log(
    "Initial supply:",
    hre.ethers.formatEther(INITIAL_MINT),
    "SILENT →",
    deployer.address
  );

  const network = await hre.ethers.provider.getNetwork();
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);

  let summary = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    product: "SilentTransfer",
    contracts: { tokens: [] },
  };

  if (fs.existsSync(outFile)) {
    try {
      summary = { ...summary, ...JSON.parse(fs.readFileSync(outFile, "utf8")) };
      summary.contracts = summary.contracts || {};
      summary.contracts.tokens = summary.contracts.tokens || [];
    } catch {
      /* fresh */
    }
  }

  const others = (summary.contracts.tokens || []).filter(
    (t) => t.symbol !== "SILENT"
  );
  summary.contracts.tokens = [
    { symbol: "SILENT", address, name: "Silent" },
    ...others,
  ];
  summary.contracts.silent = address;
  summary.product = "SilentTransfer";
  summary.deployedAt = new Date().toISOString();
  summary.chainId = Number(network.chainId);
  summary.deployer = deployer.address;

  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log("Updated", outFile);

  const webEnv = [
    `NEXT_PUBLIC_SILENT_ADDRESS=${address}`,
    `NEXT_PUBLIC_CHAIN_ID=${summary.chainId}`,
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${hre.network.name}.silent.env`), webEnv + "\n");
  console.log("Wrote", path.join(outDir, `${hre.network.name}.silent.env`));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
