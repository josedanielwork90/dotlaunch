const { isCelebrateError } = require("celebrate");

const logger = require("../../../utils/logger").scoped("API");

/**
 * Error handling for the v1 API.
 *
 * Three shapes of failure reach here and each needs a different response:
 * a validation failure from celebrate (400 with the offending field), an
 * authentication failure from express-jwt (401), and everything else, which
 * is a bug and must not leak a stack trace to the client.
 */

/** Turn a celebrate error into a flat list of field messages. */
const validationDetails = (error) => {
  const details = [];
  for (const [segment, joiError] of error.details.entries()) {
    for (const item of joiError.details) {
      details.push({
        segment,
        field: item.path.join("."),
        message: item.message,
      });
    }
  }
  return details;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  if (isCelebrateError(error)) {
    return res.status(400).json({
      message: "Request failed validation",
      details: validationDetails(error),
    });
  }

  if (error.name === "UnauthorizedError") {
    return res.status(401).json({ message: "Authentication required" });
  }

  const status = error.status || 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${error.stack}`);
    return res.status(status).json({ message: "Internal server error" });
  }

  return res.status(status).json({ message: error.message });
};

/** 404 for anything the router did not match. */
const notFound = (req, res) =>
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });

module.exports = { errorHandler, notFound, validationDetails };
