require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

// Robinhood Chain (product target). Public RPCs are rate-limited.
const RH_TESTNET_RPC =
  process.env.RH_TESTNET_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.testnet.chain.robinhood.com";

const RH_MAINNET_RPC =
  process.env.RH_MAINNET_RPC_URL ||
  "https://rpc.mainnet.chain.robinhood.com";

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Primary product testnet
    robinhoodTestnet: {
      url: RH_TESTNET_RPC,
      accounts: DEPLOYER,
      chainId: 46630,
    },
    // Alias used earlier in the repo
    hoodiTestnet: {
      url: RH_TESTNET_RPC,
      accounts: DEPLOYER,
      chainId: 46630,
    },
    robinhoodMainnet: {
      url: RH_MAINNET_RPC,
      accounts: DEPLOYER,
      chainId: 4663,
    },
    // Optional generic Ethereum testnet (not product default)
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: DEPLOYER,
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "not-needed",
    customChains: [
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
      {
        network: "robinhoodMainnet",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
