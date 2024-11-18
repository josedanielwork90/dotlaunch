const cors = require("cors");
const bodyParser = require("body-parser");
const { errors: celebrateErrors, isCelebrateError } = require("celebrate");
const routesV1 = require("../api/v1");

const expressLoader = ({ app }) => {
  app.get("/status", (req, res) => {
    res.status(200).end();
  });

  app.head("/status", (req, res) => {
    res.status(200).end();
  });

  app.enable("trust proxy");

  app.use(cors());

  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: false }));

  // parse application/json
  app.use(bodyParser.json());

  app.use("/api/v1", routesV1);

  app.use((req, res, next) => {
    const err = new Error("Not Found");
    err["status"] = 404;
    next(err);
  });

  /**
   * Request validation failures.
   *
   * celebrate throws its own error type; without this handler it fell
   * through to the catch-all below and every malformed request answered 500
   * instead of 400, so a client could not tell a bad request from an outage.
   */
  app.use(celebrateErrors());

  app.use((err, req, res, next) => {
    /**
     * Handle 401 thrown by express-jwt library
     */
    if (err.name === "UnauthorizedError") {
      return res.status(err.status || 401).send({ message: err.message }).end();
    }
    if (isCelebrateError(err)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    return next(err);
  });

  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({
      errors: {
        message: err.message,
      },
    });
  });
};

module.exports = expressLoader;
