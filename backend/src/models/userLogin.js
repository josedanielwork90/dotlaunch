const mongoose = require("mongoose");
const db = require("../loaders/mongo")();
const { USER_ROLE } = require("../helpers/constants");

const UserLogin = new mongoose.Schema(
  {
    address: {
      type: String,
    },

    network: {
      type: String,
      lowercase: true,
    },

    role: {
      type: String,
      default: USER_ROLE.USER,
    },
  },
  { timestamps: true }
);

UserLogin.index({ address: 1, network: 1 }, { unique: true, required: true });

module.exports = db.model("UserLogin", UserLogin);
