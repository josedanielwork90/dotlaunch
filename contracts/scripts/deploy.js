const { ethers } = require("hardhat");

/**
 * Deploy a single presale.
 *
 * Takes its parameters from the environment so the same script works for a
 * local chain and for testnet, and prints the resulting address for the front
 * end to be configured with by hand.
 */

const env = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable ${name}`);
    }
    return fallback;
  }
  return value;
};

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);
  console.log("Balance:", (await deployer.getBalance()).toString());

  const tokenAddress = env("TOKEN_ADDRESS");
  const softCap = ethers.utils.parseEther(env("SOFT_CAP", "10"));
  const hardCap = ethers.utils.parseEther(env("HARD_CAP", "50"));
  const presaleRate = Number(env("PRESALE_RATE", "100000"));

  const now = Math.floor(Date.now() / 1000);
  const startTime = Number(env("START_TIME", String(now + 300)));
  const endTime = Number(env("END_TIME", String(now + 86400)));

  const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");
  const presale = await LaunchpadV1.deploy(
    tokenAddress,
    [softCap, hardCap],
    [startTime, endTime],
    presaleRate,
    [
      ethers.utils.parseEther(env("MIN_BUY", "0.1")),
      ethers.utils.parseEther(env("MAX_BUY", "5")),
    ],
    env("URI_DATA", "")
  );
  await presale.deployed();

  console.log("LaunchpadV1 deployed at:", presale.address);

  const token = await ethers.getContractAt("MockERC20", tokenAddress);
  const decimals = await token.decimals();
  const allocation = hardCap
    .mul(presaleRate)
    .mul(ethers.BigNumber.from(10).pow(decimals))
    .div(ethers.constants.WeiPerEther);

  const transfer = await token.transfer(presale.address, allocation);
  await transfer.wait();

  console.log("Funded with:", allocation.toString(), "base units");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
