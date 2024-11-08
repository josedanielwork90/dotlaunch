const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const db = require("../loaders/mongo")();

const LaunchpadInfo = new mongoose.Schema({
  launchpad: {
    type: String,
  },

  user: {
    type: String,
  },

  launchPadType: {
    type: Number,
  },

  startTime: {
    type: Number,
  },

  endTime: {
    type: Number,
  },

  claimTime: {
    type: Number,
  },

  transactionHash: {
    type: String,
  },

  tokenSale: {
    type: String,
  },

  tokenPayment: {
    type: String,
  },

  status: {
    type: String,
  },

  uriData: {
    type: String,
  },

  refundWhenFinish: {
    type: Boolean,
  },

  presaleRate: {
    type: String,
  },

  listingRate: {
    type: String,
  },

  hardcap: {
    type: String,
  },

  softcap: {
    type: String,
  },

  totalRaised: {
    type: String,
    default: "0"
  },

  totalNeedToRaised: {
    type: String,
    default: "0"
  },

  adminTokenSaleFee: {
    type: String,
    default: "0"
  },

  minBuyPerParticipant: {
    type: String,
  },

  maxBuyPerParticipant: {
    type: String,
  },

  kyc: {
    type: Boolean,
    default: false,
  },

  audit: {
    type: Boolean,
    default: false,
  },

  usingWhitelist: {
    type: Boolean,
    default: false
  },

  endOfWhitelistTime: {
    type: Number,
    default: 0
  },

  whitelistUsers: {
    type: [String],
    default: []
  },
});

LaunchpadInfo.index({ transactionHash: 1 }, { unique: true, required: true });
LaunchpadInfo.index({ launchpad: 1 }, { unique: true, required: true });

LaunchpadInfo.plugin(mongoosePaginate)

module.exports = db.model("LaunchpadInfo", LaunchpadInfo);
