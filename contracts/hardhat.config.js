const path = require("path");

/**
 * Make this package's `node_modules` resolvable from outside its directory.
 *
 * The test suites live in the repository-wide `tests/` tree, which is a
 * sibling of this package rather than a descendant. Node resolves bare
 * specifiers by walking *up* from the requiring file, so a test at
 * `tests/contracts/x.test.js` would never reach `contracts/node_modules` and
 * `require("hardhat")` inside it fails with MODULE_NOT_FOUND.
 *
 * Registering the path here fixes it for the whole process without needing
 * shell-specific NODE_PATH syntax in an npm script.
 */
process.env.NODE_PATH = [
  path.join(__dirname, "node_modules"),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(path.delimiter);
require("module").Module._initPaths();

require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");

/**
 * The well-known Foundry/Hardhat development mnemonic. It is public by
 * design, funds no real account, and lets `anvil`, `hardhat node` and the
 * deploy scripts all derive the same addresses - which is what makes the
 * seeded demo environment reproducible.
 *
 * Real deployments must supply DEPLOYER_MNEMONIC (or DEPLOYER_PRIVATE_KEY)
 * through the environment; nothing sensitive is ever committed here.
 */
const DEV_MNEMONIC = "test test test test test test test test test test test junk";

const mnemonic = process.env.DEPLOYER_MNEMONIC || DEV_MNEMONIC;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

/** Accounts for a named network: an explicit key if given, else the HD wallet. */
const accountsFor = () =>
  privateKey ? [privateKey] : { mnemonic, count: 20 };

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: { mnemonic, count: 20, accountsBalance: "10000000000000000000000" },
    },
    // Local anvil / hardhat node used by docker-compose and the seed script.
    localhost: {
      url: process.env.CHAIN_RPC_URL || "http://127.0.0.1:8545",
      chainId: Number(process.env.CHAIN_ID || 31337),
      accounts: accountsFor(),
    },
    testnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s3.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: accountsFor(),
    },
    mainnet: {
      url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: accountsFor(),
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: false,
  },
  // Tests live in the repository-wide `tests/` tree rather than beside the
  // contracts, so every package's suite is reachable from one place.
  paths: {
    tests: "../tests/contracts",
  },
  mocha: {
    timeout: 120000,
  },
};
