const { getNumberFromBN } = require("../../../helpers/bn");

module.exports.formatLaunchpadCreated = (log) => ({
  user: log.args.deployer,
  tokenSale: log.args.tokenSale,
  tokenPayment: log.args.tokenPayment,
  launchpad: log.args.launchpad,
  launchPadType: Number(log.args.launchPadType),
  uriData: String(log.args.uriData),
  refundWhenFinish: String(log.args.refundWhenFinish) === "true",
  startTime: getNumberFromBN(log.args.startTime) * 1000,
  endTime: getNumberFromBN(log.args.endTime) * 1000,
  claimTime: getNumberFromBN(log.args.claimTime) * 1000,
  transactionHash: log.transactionHash,
  adminTokenSaleFee: String(log.args.adminTokenSaleFee)
});

module.exports.formatLaunchpadParameter = (log) => ({
  launchpad: log.args.launchpad,
  softcap: String(log.args.softcap),
  hardcap: String(log.args.hardcap),
  presaleRate: String(log.args.presaleRate),
  listingRate: String(log.args.listingRate),
  minBuyPerParticipant: String(log.args.minBuyPerParticipant),
  maxBuyPerParticipant: String(log.args.maxBuyPerParticipant),
  transactionHash: log.transactionHash,
});

module.exports.formatLaunchpadStateChanged = (log) => ({
  launchpad: log.args.launchpad,
  status: getNumberFromBN(log.args.state),
  transactionHash: log.transactionHash,
});

module.exports.formatLaunchpadRaisedChanged = (log) => ({
  launchpad: log.args.launchpad,
  totalRaised: String(log.args.newRaisedAmount),
  // The event parameter is named newNeedToRaised; reading it as
  // totalNeedToRaised produced the string "undefined" for every record.
  totalNeedToRaised: String(log.args.newNeedToRaised),
})

module.exports.formatLaunchpadActionChanged = (log) => ({
  launchpad: log.args.launchpad,
  usingWhitelist: String(log.args.usingWhitelist) === "true",
  endOfWhitelistTime: getNumberFromBN(log.args.endOfWhitelistTime) * 1000
})

module.exports.formatLaunchpadWhitelistUsersChanged = (log) => ({
  launchpad: log.args.launchpad,
  whitelistUsers: log.args.users,
  action: getNumberFromBN(log.args.action)
})
