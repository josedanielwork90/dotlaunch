/**
 * Deploys the full DotLaunch contract set and records the addresses.
 *
 * Run against the local chain, this is the first half of `npm run seed`:
 * it puts the four platform contracts on chain and writes their addresses
 * to `deployments/<network>.json`, which the API and the web app read at
 * startup. The second half (`seed-demo-data.js`) fills them with demo
 * tokens, presales and locks.
 *
 * Addresses are deterministic. A fresh chain plus the fixed development
 * mnemonic plus this fixed deployment order always yields the same
 * addresses, which is what lets the seeded environment be reproducible and
 * lets screenshots stay valid across rebuilds.
 *
 *   npx hardhat run --network localhost scripts/deploy-all.js
 */

const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

/**
 * Creation fee schedule for the token factory, in wei.
 *
 * Kept low deliberately: on a local chain a reviewer should be able to mint
 * a token without first working out how to fund an account.
 */
const TOKEN_FACTORY_FEES = {
  normal: ethers.utils.parseEther("0.001"),
  mint: ethers.utils.parseEther("0.0005"),
  burn: ethers.utils.parseEther("0.0005"),
  pause: ethers.utils.parseEther("0.0005"),
  blacklist: ethers.utils.parseEther("0.0005"),
  deflation: ethers.utils.parseEther("0.002"),
};

/** Deploy one contract and wait for it to be mined. */
const deploy = async (name, ...args) => {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  console.log(`  ${name.padEnd(20)} ${contract.address}`);
  return contract;
};

/** Where deployment records for a network are written. */
const deploymentPath = (networkName) =>
  path.join(__dirname, "..", "deployments", `${networkName}.json`);

const writeDeployment = (networkName, record) => {
  const file = deploymentPath(networkName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
};

/**
 * A previous deployment that is still live on this chain, or null.
 *
 * Deploying is not idempotent by nature: a second run would mint a second
 * set of contracts at different, nonce-derived addresses, silently
 * invalidating the addresses baked into .env.docker and leaving the API and
 * the web app pointing at the first set while new data landed in the second.
 *
 * `docker compose run` restarts dependencies, so a second deploy is not a
 * hypothetical - it happens any time someone runs the seed service. Checking
 * for live bytecode at the recorded addresses makes re-running a no-op.
 */
const existingDeployment = async (networkName) => {
  const file = deploymentPath(networkName);
  if (!fs.existsSync(file)) return null;

  let record;
  try {
    record = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }

  const addresses = Object.values(record.contracts || {});
  if (addresses.length === 0) return null;

  const codes = await Promise.all(
    addresses.map((address) => ethers.provider.getCode(address))
  );
  const allLive = codes.every((code) => code && code !== "0x");

  return allLive ? record : null;
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const balance = await deployer.getBalance();

  const existing = await existingDeployment(network.name);
  if (existing) {
    console.log("DotLaunch contracts are already deployed on this chain.");
    Object.entries(existing.contracts).forEach(([name, address]) => {
      console.log(`  ${name.padEnd(20)} ${address}`);
    });
    console.log("\nNothing to do. Delete the deployment record or reset the");
    console.log("chain (docker compose down -v) to deploy afresh.");
    return;
  }

  console.log("Deploying DotLaunch contracts");
  console.log(`  network   ${network.name} (chainId ${chainId})`);
  console.log(`  deployer  ${deployer.address}`);
  console.log(`  balance   ${ethers.utils.formatEther(balance)} ETH\n`);

  if (balance.isZero()) {
    throw new Error(
      `Deployer ${deployer.address} has no balance on ${network.name}.`
    );
  }

  const launchpadDeployer = await deploy("LaunchpadDeployer");
  const tokenLock = await deploy("SenseiLock");
  const manageToken = await deploy("ManageToken");
  const bulkTransfer = await deploy("BulkTransfer");

  // The factory ships with a zero fee schedule; set the real one so the
  // "Create Token" screen has prices to display.
  const feeTx = await manageToken.initFee(
    TOKEN_FACTORY_FEES.normal,
    TOKEN_FACTORY_FEES.mint,
    TOKEN_FACTORY_FEES.burn,
    TOKEN_FACTORY_FEES.pause,
    TOKEN_FACTORY_FEES.blacklist,
    TOKEN_FACTORY_FEES.deflation
  );
  await feeTx.wait();
  console.log("\n  token factory fee schedule initialised");

  const blockNumber = await ethers.provider.getBlockNumber();

  const record = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    // Block the contracts went live in. The API's event listener starts
    // scanning here rather than from genesis, which keeps the first sync
    // fast on a long-lived chain.
    startBlock: blockNumber,
    contracts: {
      launchpadDeployer: launchpadDeployer.address,
      tokenLock: tokenLock.address,
      manageToken: manageToken.address,
      bulkTransfer: bulkTransfer.address,
    },
    fees: Object.fromEntries(
      Object.entries(TOKEN_FACTORY_FEES).map(([k, v]) => [k, v.toString()])
    ),
  };

  const file = writeDeployment(network.name, record);
  console.log(`\nDeployment written to ${path.relative(process.cwd(), file)}`);

  // Emitted in .env form so a shell can `eval` it straight into the
  // environment when running the stack outside docker-compose.
  console.log("\n# --- environment ---");
  console.log(`CONTRACT_LAUNCHPAD_DEPLOYER=${launchpadDeployer.address}`);
  console.log(`CONTRACT_TOKEN_LOCK=${tokenLock.address}`);
  console.log(`CONTRACT_TOKEN_MANAGE=${manageToken.address}`);
  console.log(`CONTRACT_MULTISEND=${bulkTransfer.address}`);
  console.log(`EVENT_LISTENER_START_BLOCK=${record.startBlock}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
