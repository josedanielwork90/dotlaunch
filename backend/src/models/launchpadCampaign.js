const mongoose = require("mongoose");
const db = require("../loaders/mongo")();

const LaunchpadCampaign = new mongoose.Schema({
  owner: {
    type: String,
  },

  description: {
    type: String,
  },

  discord: {
    type: String,
  },

  facebook: {
    type: String,
  },

  github: {
    type: String,
  },

  logo: {
    type: String,
  },

  reddit: {
    type: String,
  },

  telegram: {
    type: String,
  },

  twitter: {
    type: String,
  },

  youtube: {
    type: String,
  },

  updates: {
    type: String,
  },

  website: {
    type: String,
  },

  opcode: {
    type: String,
  },
});

LaunchpadCampaign.index({ opcode: 1 }, { unique: true, required: true });

module.exports = db.model("LaunchpadCampaign", LaunchpadCampaign);
