const createApp = require("./createApp");
const config = require("./config");
const loggerContainer = require("./loaders/loggerContainer");
const { loader: queueLoader } = require("./loaders/queue");
const bscEventLoader = require("./loaders/bscEventListener/loader");

const logger = loggerContainer.get("API");

/**
 * Production entry point.
 *
 * Builds the app, starts the background workers, then listens. The event
 * listener is optional so the API can be run on its own - useful when
 * debugging, and required by the test suite, which must not start cron jobs.
 */
const startServer = async () => {
  const app = createApp();

  queueLoader();

  if (config.eventListener.enabled) {
    bscEventLoader();
  } else {
    logger.info("Event listener disabled (EVENT_LISTENER_ENABLED=false)");
  }

  const server = app.listen(config.port, () => {
    logger.info(`API listening on port ${config.port}`);
  });

  server.on("error", (error) => {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });

  // Compose sends SIGTERM on `down`; closing cleanly avoids a 10-second wait
  // for the container to be killed.
  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
