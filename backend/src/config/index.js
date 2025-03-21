/**
 * Central runtime configuration.
 *
 * Every value is sourced from the environment so that the same image can run
 * against a local chain, a testnet or production without a rebuild. The
 * defaults below are deliberately the *local development* values used by
 * docker-compose - they are not secrets and are safe to commit.
 */

const fs = require("fs");
const path = require("path");

const requireInProduction = (name, value) => {
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Refusing to start in production with a development default.`
    );
  }
  return value;
};

const int = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable "${name}" must be an integer.`);
  }
  return parsed;
};

const bool = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
};

const str = (name, fallback) => {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
};

/**
 * Addresses and start block recorded by the contract deploy script.
 *
 * docker-compose mounts the deployments volume read-only into the API, so
 * the API can discover where the contracts live and which block they went
 * live in without those values having to be duplicated into the environment
 * by hand. Environment variables still win when set.
 */
const deploymentRecord = (() => {
  const dir = str("DEPLOYMENTS_DIR", "./deployments");
  const name = str("DEPLOYMENT_NAME", "localhost");
  const file = path.join(dir, `${name}.json`);

  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
})();

/** Deployed address for `key`, preferring the environment over the record. */
const contractAddress = (envName, key) =>
  str(envName, deploymentRecord?.contracts?.[key] || "");

const config = Object.freeze({
  env: str("NODE_ENV", "development"),
  port: int("PORT", 8888),

  mongo: {
    url: str("MONGO_URL", "mongodb://127.0.0.1:27017/dotlaunch"),
  },

  redis: {
    url: str("REDIS_URL", "redis://127.0.0.1:6379"),
  },

  jwt: {
    secret: requireInProduction(
      "JWT_SECRET",
      str("JWT_SECRET", "dotlaunch-local-development-secret")
    ),
    ttl: int("JWT_TTL", 126000),
    algorithms: ["HS256"],
  },

  chain: {
    // Local anvil node by default; override for BSC testnet/mainnet.
    rpcUrl: str("CHAIN_RPC_URL", "http://127.0.0.1:8545"),
    chainId: int("CHAIN_ID", 31337),
    name: str("CHAIN_NAME", "localhost"),
    // Block confirmations to wait before treating a log as final. Local
    // chains mine instantly, so zero is correct there.
    confirmations: int("CHAIN_CONFIRMATIONS", 0),
  },

  contracts: {
    launchpadDeployer: contractAddress(
      "CONTRACT_LAUNCHPAD_DEPLOYER",
      "launchpadDeployer"
    ),
    tokenLock: contractAddress("CONTRACT_TOKEN_LOCK", "tokenLock"),
    tokenManage: contractAddress("CONTRACT_TOKEN_MANAGE", "manageToken"),
    multisend: contractAddress("CONTRACT_MULTISEND", "bulkTransfer"),
  },

  eventListener: {
    enabled: bool("EVENT_LISTENER_ENABLED", true),
    blockRange: int("EVENT_LISTENER_BLOCK_RANGE", 1000),
    cronPattern: str("EVENT_LISTENER_CRON", "10,30,50 * * * * *"),
    timeoutSeconds: int("EVENT_LISTENER_TIMEOUT_SEC", 90),
    jobName: str("EVENT_LISTENER_JOB", "Event1_0"),
    reduceRange: int("EVENT_LISTENER_REDUCE_RANGE", 5),
    // Defaults to the block the contracts were deployed in, so the listener
    // replays from first principles on a cold start instead of guessing at a
    // recent window and silently missing earlier launches.
    startBlock: int(
      "EVENT_LISTENER_START_BLOCK",
      deploymentRecord?.startBlock || 0
    ),
  },


  storage: {
    // "local" keeps uploads on disk so the stack runs with no internet
    // access; "pinata" pins to IPFS and requires PINATA_JWT.
    driver: str("STORAGE_DRIVER", "local"),
    localDir: str("STORAGE_LOCAL_DIR", "./.storage"),
    publicBaseUrl: str("STORAGE_PUBLIC_BASE_URL", "http://localhost:8888/api/v1/storage"),
    pinataJwt: str("PINATA_JWT", ""),
    pinataGateway: str("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs/"),
  },
});

module.exports = config;
