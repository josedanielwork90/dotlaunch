const ethers = require("ethers");
const provider = require("../../helpers/serviceProvider");
const { abi } = require("./build/LaunchpadDeployer.json");

const appConfig = require("../../../../config");
const launchpadDeployerContract = new ethers.Contract(
  appConfig.contracts.launchpadDeployer,
  abi,
  provider
);

module.exports = launchpadDeployerContract;
