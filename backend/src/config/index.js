/**
 * Central runtime configuration.
 *
 * Every value is sourced from the environment so that the same image can run
 * against a local chain, a testnet or production without a rebuild. The
 * defaults below are the local development values and are safe to commit.
 */

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
    rpcUrl: str(
      "CHAIN_RPC_URL",
      "https://data-seed-prebsc-1-s1.binance.org:8545/"
    ),
    chainId: int("CHAIN_ID", 97),
    name: str("CHAIN_NAME", "bsc-testnet"),
  },

  contracts: {
    launchpadDeployer: str("CONTRACT_LAUNCHPAD_DEPLOYER", ""),
    tokenLock: str("CONTRACT_TOKEN_LOCK", ""),
    tokenManage: str("CONTRACT_TOKEN_MANAGE", ""),
    multisend: str("CONTRACT_MULTISEND", ""),
  },

  eventListener: {
    enabled: bool("EVENT_LISTENER_ENABLED", true),
    blockRange: int("EVENT_LISTENER_BLOCK_RANGE", 1000),
    cronPattern: str("EVENT_LISTENER_CRON", "10,30,50 * * * * *"),
    timeoutSeconds: int("EVENT_LISTENER_TIMEOUT_SEC", 90),
    jobName: str("EVENT_LISTENER_JOB", "Event1_0"),
    reduceRange: int("EVENT_LISTENER_REDUCE_RANGE", 5),
  },

  ipfs: {
    pinataJwt: str("PINATA_JWT", ""),
    gatewayUrl: str("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs/"),
  },
});

module.exports = config;
