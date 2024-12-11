const mongoose = require("mongoose");
const db = require("../loaders/mongo")();

const ListenerState = new mongoose.Schema(
  {
    jobName: {
      type: String,
      index: true,
      unique: true,
    },
    lastListenedBlock: {
      type: Number,
    },
    lastCronBlock: {
      type: Number,
    },
    isForcedCron: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = db.model("ListenerState", ListenerState);
