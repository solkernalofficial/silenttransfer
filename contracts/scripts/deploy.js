const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set DEPLOYER_PRIVATE_KEY in contracts/.env"
    );
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      `Deployer has 0 ETH. Fund ${deployer.address} on ${hre.network.name} via a faucet, then re-run.`
    );
  }

  const Registry = await hre.ethers.getContractFactory("ERC6538Registry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("ERC6538Registry:", registryAddr);

  const Messenger = await hre.ethers.getContractFactory("ERC5564Messenger");
  const messenger = await Messenger.deploy(deployer.address);
  await messenger.waitForDeployment();
  const messengerAddr = await messenger.getAddress();
  console.log("ERC5564Messenger:", messengerAddr);

  const Oracle = await hre.ethers.getContractFactory("MockComplianceOracle");
  const oracle = await Oracle.deploy(deployer.address);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("MockComplianceOracle:", oracleAddr);

  // Product token — Silent (SILENT)
  const Silent = await hre.ethers.getContractFactory("SilentToken");
  const silent = await Silent.deploy(
    "Silent",
    "SILENT",
    18,
    deployer.address,
    hre.ethers.parseEther("1000000000") // 1B SILENT — allocation plan: 60% community, 35% foundation, 15% team, 0% VC
  );
  await silent.waitForDeployment();
  const silentAddr = await silent.getAddress();
  console.log("SILENT (1B):", silentAddr);

  const tokens = [
    { name: "USDG Stablecoin", symbol: "USDG" },
    { name: "Apple Stock Token", symbol: "AAPL" },
    { name: "NVIDIA Stock Token", symbol: "NVDA" },
    { name: "Google Stock Token", symbol: "GOOGL" },
    { name: "Microsoft Stock Token", symbol: "MSFT" },
  ];

  const deployedTokens = [
    { symbol: "SILENT", address: silentAddr, name: "Silent" },
  ];
  for (const t of tokens) {
    const Token = await hre.ethers.getContractFactory("MockStockToken");
    const token = await Token.deploy(t.name, t.symbol, deployer.address);
    await token.waitForDeployment();
    const addr = await token.getAddress();
    console.log(`${t.symbol}:`, addr);
    deployedTokens.push({ symbol: t.symbol, address: addr });
    try {
      await (await token.toggleCompliance()).wait();
    } catch {
      /* optional */
    }
  }

  const Paymaster = await hre.ethers.getContractFactory("SilentPaymaster");
  const paymaster = await Paymaster.deploy(deployer.address, deployer.address);
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  console.log("SilentPaymaster:", paymasterAddr);

  const network = await hre.ethers.provider.getNetwork();
  const summary = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    product: "SilentTransfer",
    contracts: {
      registry: registryAddr,
      messenger: messengerAddr,
      oracle: oracleAddr,
      paymaster: paymasterAddr,
      silent: silentAddr,
      tokens: deployedTokens,
      protocolFeeBps: 100,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log("\nWrote", outFile);

  const apiSnippet = [
    `CHAIN_ID=${summary.chainId}`,
    `RPC_URL=${process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || ""}`,
    `REGISTRY_CONTRACT_ADDRESS=${registryAddr}`,
    `MESSENGER_CONTRACT_ADDRESS=${messengerAddr}`,
    `PAYMASTER_CONTRACT_ADDRESS=${paymasterAddr}`,
    `SILENT_TOKEN_ADDRESS=${silentAddr}`,
  ].join("\n");
  const webSnippet = [
    `NEXT_PUBLIC_CHAIN_ID=${summary.chainId}`,
    `NEXT_PUBLIC_RPC_URL=${process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || ""}`,
    `NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddr}`,
    `NEXT_PUBLIC_MESSENGER_ADDRESS=${messengerAddr}`,
    `NEXT_PUBLIC_SILENT_ADDRESS=${silentAddr}`,
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${hre.network.name}.api.env`), apiSnippet + "\n");
  fs.writeFileSync(path.join(outDir, `${hre.network.name}.web.env`), webSnippet + "\n");

  console.log("\n=== SilentTransfer Deployment Summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
