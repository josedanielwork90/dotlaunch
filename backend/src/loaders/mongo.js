const mongoose = require("mongoose");

const config = require("../config");
const loggerContainer = require("./loggerContainer");

const logger = loggerContainer.get("MONGO");

/**
 * The single shared MongoDB connection.
 *
 * Each model module calls this loader at import time. Previously that opened
 * a fresh connection per model — four models meant four connection pools to
 * the same database, four sets of sockets and four independent reconnect
 * cycles. Memoising it here means every model shares one pool, which is what
 * mongoose expects.
 */
let connection = null;

/**
 * Connect to MongoDB, or return the existing connection.
 *
 * @returns {import("mongoose").Connection}
 */
const mongoLoader = () => {
  if (connection) return connection;

  connection = mongoose.createConnection(config.mongo.url, {
    // Fail fast rather than queueing operations forever behind an
    // unreachable server: a container that cannot reach mongo should report
    // unhealthy, not hang.
    serverSelectionTimeoutMS: 5000,
  });

  // createConnection returns a thenable. Without this catch, an unreachable
  // database surfaces as an unhandled promise rejection that takes the whole
  // process down on startup - the API should report unhealthy and keep
  // serving, not crash, while mongo is coming up.
  connection.asPromise().catch((error) => {
    logger.error(`Initial MongoDB connection failed: ${error.message}`);
  });

  connection.on("connected", () => {
    logger.info(`Connected to MongoDB at ${config.mongo.url}`);
  });

  connection.on("error", (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });

  connection.on("disconnected", () => {
    logger.warn("Disconnected from MongoDB");
  });

  return connection;
};

/**
 * Close the shared connection and clear the memo.
 *
 * Used by tests, which point the loader at an in-memory server per suite and
 * need the next call to reconnect rather than hand back a closed connection.
 */
mongoLoader.close = async () => {
  if (!connection) return;
  await connection.close();
  connection = null;
};

/** The current connection without creating one. Null before first use. */
mongoLoader.current = () => connection;

module.exports = mongoLoader;
