const winston = require("winston");

/**
 * Named application loggers.
 *
 * Every logger shares one line format so `docker compose logs` reads as a
 * single stream: `[LEVEL] 2025-06-15 12:00:00 - [SCOPE] message`. Loggers are
 * created on demand rather than registered up front, so a new subsystem can
 * call `loggerContainer.get("MY_SCOPE")` without touching this file and still
 * get the shared configuration instead of a transport-less default.
 */

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/** Suppress log output during tests unless explicitly enabled. */
const SILENT = process.env.NODE_ENV === "test" && process.env.LOG_LEVEL === undefined;

const formatFor = (scope) =>
  winston.format.printf((info) => {
    const datetime = new Date().toISOString().replace("T", " ").split(".")[0];
    const message =
      info.message instanceof Error ? info.message.stack : info.message;
    return `[${info.level.toUpperCase()}] ${datetime} - [${scope}] ${message}`;
  });

const optionsFor = (scope) => ({
  level: LOG_LEVEL,
  format: formatFor(scope),
  transports: [new winston.transports.Console({ silent: SILENT })],
});

// Pre-register the long-lived scopes so their configuration is visible here
// rather than only at first use.
["EVENT_LISTENER_WORKER", "MONGO", "API", "SEED"].forEach((scope) => {
  winston.loggers.add(scope, optionsFor(scope));
});

module.exports = {
  /**
   * Logger for `scope`, created with the shared configuration if new.
   *
   * @param {string} scope
   * @returns {import("winston").Logger}
   */
  get(scope) {
    if (!winston.loggers.has(scope)) {
      winston.loggers.add(scope, optionsFor(scope));
    }
    return winston.loggers.get(scope);
  },
};
