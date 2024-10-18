const winston = require("winston");

/**
 * Application logger.
 *
 * One console transport, one line format, shared by every module. The format
 * is deliberately flat rather than JSON: everything runs under docker compose
 * during development and `docker compose logs` is much easier to read when
 * each line is a line.
 */

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const lineFormat = winston.format.printf((info) => {
  const datetime = new Date().toISOString().replace("T", " ").split(".")[0];
  const message =
    info.message instanceof Error ? info.message.stack : info.message;
  return `[${info.level.toUpperCase()}] ${datetime} - ${message}`;
});

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: lineFormat,
  transports: [new winston.transports.Console()],
});

/**
 * Prefix every line with a subsystem name.
 *
 * Returns a thin wrapper rather than a real child logger, because winston's
 * child loggers put the metadata in an object the printf format above would
 * have to unpack anyway.
 */
logger.scoped = (scope) => ({
  info: (message) => logger.info(`[${scope}] ${message}`),
  warn: (message) => logger.warn(`[${scope}] ${message}`),
  error: (message) => logger.error(`[${scope}] ${message}`),
  debug: (message) => logger.debug(`[${scope}] ${message}`),
});

module.exports = logger;
