const router = require("express").Router();

const config = require("../../../config");
const mongoLoader = require("../../../loaders/mongo");
const { getStorageProvider } = require("../../../services/storage");

/**
 * Health and readiness.
 *
 * `/health` is what the container healthcheck polls, and what gates the web
 * app's startup in docker-compose: the app is only allowed to start once the
 * API reports that its dependencies are actually reachable, rather than
 * merely that the process is alive.
 */

const MONGO_READY_STATE = Object.freeze({
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
});

/**
 * Mongo connection state, without issuing a query.
 *
 * Reads the shared connection the models use, not mongoose's default
 * connection — this app connects via `createConnection`, so the default one
 * is always idle and would report a false negative.
 */
const checkMongo = () => {
  const state = mongoLoader.current()?.readyState ?? 0;
  return {
    ok: state === 1,
    detail: MONGO_READY_STATE[state] || "unknown",
  };
};

/** Chain reachability: the node must answer and report the expected id. */
const checkChain = async () => {
  try {
    const { ethers } = require("ethers");
    const provider = new ethers.providers.JsonRpcProvider(config.chain.rpcUrl);
    const network = await provider.getNetwork();

    if (network.chainId !== config.chain.chainId) {
      return {
        ok: false,
        detail: `expected chainId ${config.chain.chainId}, node reported ${network.chainId}`,
      };
    }

    const blockNumber = await provider.getBlockNumber();
    return { ok: true, detail: `chainId ${network.chainId} at block ${blockNumber}` };
  } catch (error) {
    return { ok: false, detail: `unreachable: ${error.message}` };
  }
};

/**
 * GET /api/v1/health
 *
 * 200 when every dependency is healthy, 503 otherwise. The body always lists
 * each check so a failing container says *what* is wrong in `docker logs`.
 */
router.get("/", async (req, res) => {
  const [storage, chain] = await Promise.all([
    getStorageProvider().health(),
    checkChain(),
  ]);

  const checks = { mongo: checkMongo(), storage, chain };
  const healthy = Object.values(checks).every((check) => check.ok);

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    version: process.env.npm_package_version || "1.0.0",
    environment: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    checks,
  });
});

/**
 * GET /api/v1/health/live
 *
 * Liveness only — is the process running. Never touches a dependency, so a
 * database outage does not cause the orchestrator to restart a healthy app.
 */
router.get("/live", (req, res) => res.status(200).json({ status: "ok" }));

module.exports = router;
