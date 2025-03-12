const expressLoader = require("./express");
const mongoLoader = require("./mongo");
const { loader: queueLoader } = require("./queue");
const bscEventLoader = require("./bscEventListener/loader");

const loader = async ({ app }) => {
  expressLoader({ app });
  mongoLoader();
  queueLoader();
  bscEventLoader();
};

module.exports = loader;
