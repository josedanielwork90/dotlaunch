const mongoose = require("mongoose");
const db = require("../loaders/mongo")();

/**
 * A watcher on a presale.
 *
 * Someone who wants to be told when a sale they are interested in opens,
 * closes or changes state. Keyed on the pair so a wallet cannot subscribe to
 * the same sale twice on one channel, and holds the delivery destination so
 * a wallet can be reachable more than one way.
 *
 * Registered directly by the controller rather than through `models/index`:
 * notifications are a self-contained feature and nothing else needs to know
 * this collection exists.
 */
const Subscription = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      lowercase: true,
    },

    launchpad: {
      type: String,
      required: true,
      lowercase: true,
    },

    channel: {
      type: String,
      enum: ["email", "telegram", "webhook"],
      default: "email",
    },

    destination: {
      type: String,
      required: true,
    },

    events: {
      type: [String],
      default: ["opening", "closing", "finished"],
    },

    verified: {
      type: Boolean,
      default: false,
    },

    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

Subscription.index({ address: 1, launchpad: 1, channel: 1 }, { unique: true });
Subscription.index({ launchpad: 1, verified: 1 });

module.exports = db.model("Subscription", Subscription);
