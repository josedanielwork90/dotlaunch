const ethers = require("ethers");

module.exports.getNumberFromBN = (number) =>
  ethers.BigNumber.isBigNumber(number) ? Number(number) : number;

module.exports.setNumberToBN = (number) =>
  ethers.BigNumber.isBigNumber(number) ? number : ethers.BigNumber.from(number);

module.exports.getPriceNumberFromBN = (number) =>
  ethers.BigNumber.isBigNumber(number)
    ? ethers.utils.formatEther(number)
    : number;

module.exports.getHexaNumberFromBN = (number) =>
  (ethers.BigNumber.isBigNumber(number)
    ? number
    : ethers.BigNumber.from(number)
  ).toHexString();
