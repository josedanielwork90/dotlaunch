const express = require("express");

const expressLoader = require("./loaders/express");
const mongoLoader = require("./loaders/mongo");
const config = require("./config");

/**
 * Build the Express application without starting a server.
 *
 * Separating construction from listening is what makes the API testable:
 * supertest can drive the app object directly, with no port to bind and no
 * background workers running. `src/app.js` is the production entry point and
 * adds the listener and queue on top of this.
 *
 * @param {{withMongo?: boolean}} [options]
 */
const createApp = ({ withMongo = true } = {}) => {
  const app = express();

  if (withMongo) mongoLoader();
  expressLoader({ app });

  return app;
};

module.exports = createApp;
module.exports.config = config;
