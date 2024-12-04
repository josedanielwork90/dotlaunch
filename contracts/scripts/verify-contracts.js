const { run, ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Submit deployed sources to the block explorer.
 *
 *   npx hardhat run --network testnet scripts/verify-contracts.js
 *
 * Reads the addresses the deploy script recorded, so it verifies exactly what
 * is on chain rather than whatever happens to be in the working tree. Already
 * verified is treated as success: re-running after a partial failure should
 * not need the successful entries commented out.
 */

const DEPLOYMENTS_DIR = process.env.DEPLOYMENTS_DIR || "./deployments";

const loadDeployment = () => {
  const file = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment record at ${file}. Run the deploy script first.`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const alreadyVerified = (message) =>
  /already verified/i.test(message) || /Already Verified/i.test(message);

const verify = async (name, address, constructorArguments = []) => {
  if (!address || address === ethers.constants.AddressZero) {
    console.log(`- ${name}: no address recorded, skipping`);
    return "skipped";
  }

  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`- ${name} (${address}): verified`);
    return "verified";
  } catch (error) {
    if (alreadyVerified(error.message)) {
      console.log(`- ${name} (${address}): already verified`);
      return "already";
    }
    console.error(`- ${name} (${address}): FAILED - ${error.message}`);
    return "failed";
  }
};

async function main() {
  if (network.name === "localhost" || network.name === "hardhat") {
    throw new Error(
      "There is no explorer for a local chain. Verification only applies to a public network."
    );
  }

  const deployment = loadDeployment();
  const { contracts } = deployment;

  console.log(`Verifying ${network.name} deployment from block ${deployment.startBlock}`);

  const outcomes = [];
  outcomes.push(await verify("LaunchpadDeployer", contracts.launchpadDeployer));
  outcomes.push(await verify("ManageToken", contracts.manageToken));
  outcomes.push(await verify("BulkTransfer", contracts.bulkTransfer));
  outcomes.push(await verify("SenseiLock", contracts.tokenLock));

  const failed = outcomes.filter((outcome) => outcome === "failed").length;
  if (failed > 0) {
    throw new Error(`${failed} contract(s) failed verification`);
  }

  console.log("All contracts verified.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
