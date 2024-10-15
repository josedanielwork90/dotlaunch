/**
 * Runtime configuration.
 *
 * Read once at startup from the environment, with development defaults so a
 * fresh clone runs without a .env file.
 */

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8888),

  mongo: {
    url: process.env.MONGO_URL || "mongodb://127.0.0.1:27017/dotlaunch",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dotlaunch-local-development-secret",
    ttl: Number(process.env.JWT_TTL || 126000),
    algorithms: ["HS256"],
  },

  chain: {
    rpcUrl: process.env.CHAIN_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
    chainId: Number(process.env.CHAIN_ID || 97),
  },
};

module.exports = config;
