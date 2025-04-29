const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Configuration resolution.
 *
 * Config is read once at import time, so each case clears the module cache
 * and re-imports with a fresh environment.
 */
const loadConfig = (env = {}) => {
  jest.resetModules();

  const saved = { ...process.env };
  Object.keys(env).forEach((key) => {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });

  try {
    // eslint-disable-next-line global-require
    return require("../../../backend/src/config");
  } finally {
    process.env = saved;
  }
};

describe("config", () => {
  describe("defaults", () => {
    it("falls back to local development values", () => {
      const config = loadConfig({
        MONGO_URL: undefined,
        REDIS_URL: undefined,
        CHAIN_RPC_URL: undefined,
        PORT: undefined,
      });

      expect(config.mongo.url).toContain("mongodb://");
      expect(config.redis.url).toContain("redis://");
      expect(config.port).toBe(8888);
      expect(config.storage.driver).toBe("local");
    });

    /**
     * A local chain has instant finality, so holding blocks back from the
     * head is wrong there - and actively harmful, because a chain that only
     * mines on demand would never surface its most recent blocks.
     */
    it("waits for no confirmations by default", () => {
      const config = loadConfig({ CHAIN_CONFIRMATIONS: undefined });
      expect(config.chain.confirmations).toBe(0);
    });
  });

  describe("parsing", () => {
    it("reads integers", () => {
      expect(loadConfig({ PORT: "9000" }).port).toBe(9000);
    });

    it("rejects a non-numeric integer rather than silently using NaN", () => {
      expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(
        /must be an integer/i
      );
    });

    it.each([
      ["true", true],
      ["1", true],
      ["yes", true],
      ["on", true],
      ["TRUE", true],
      ["false", false],
      ["0", false],
      ["anything-else", false],
    ])("reads %p as %p", (raw, expected) => {
      expect(loadConfig({ EVENT_LISTENER_ENABLED: raw }).eventListener.enabled).toBe(
        expected
      );
    });

    it("treats an empty string as unset", () => {
      expect(loadConfig({ PORT: "" }).port).toBe(8888);
    });
  });

  describe("production guards", () => {
    /**
     * The development JWT secret is committed. Booting production with it
     * would mean anyone reading the repository could mint valid tokens, so
     * startup must fail rather than fall back.
     */
    it("refuses to start in production without a JWT secret", () => {
      expect(() =>
        loadConfig({ NODE_ENV: "production", JWT_SECRET: undefined })
      ).toThrow(/JWT_SECRET/);
    });

    it("starts in production when the secret is supplied", () => {
      const config = loadConfig({
        NODE_ENV: "production",
        JWT_SECRET: "a-real-secret",
      });
      expect(config.jwt.secret).toBe("a-real-secret");
    });

    it("allows the development default outside production", () => {
      const config = loadConfig({ NODE_ENV: "development", JWT_SECRET: undefined });
      expect(config.jwt.secret).toBeTruthy();
    });
  });

  describe("deployment record", () => {
    let directory;

    beforeEach(() => {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), "dotlaunch-deploy-"));
    });

    afterEach(() => {
      fs.rmSync(directory, { recursive: true, force: true });
    });

    const writeRecord = (record) =>
      fs.writeFileSync(
        path.join(directory, "localhost.json"),
        JSON.stringify(record)
      );

    it("reads contract addresses and start block from the record", () => {
      writeRecord({
        startBlock: 27,
        contracts: {
          launchpadDeployer: "0xDeployer",
          tokenLock: "0xLock",
          manageToken: "0xFactory",
          bulkTransfer: "0xMultisend",
        },
      });

      const config = loadConfig({
        DEPLOYMENTS_DIR: directory,
        CONTRACT_LAUNCHPAD_DEPLOYER: undefined,
        CONTRACT_TOKEN_LOCK: undefined,
        CONTRACT_TOKEN_MANAGE: undefined,
        CONTRACT_MULTISEND: undefined,
        EVENT_LISTENER_START_BLOCK: undefined,
      });

      expect(config.contracts.launchpadDeployer).toBe("0xDeployer");
      expect(config.contracts.tokenManage).toBe("0xFactory");
      expect(config.contracts.multisend).toBe("0xMultisend");
      expect(config.eventListener.startBlock).toBe(27);
    });

    it("lets the environment override the record", () => {
      writeRecord({
        startBlock: 27,
        contracts: { launchpadDeployer: "0xFromFile" },
      });

      const config = loadConfig({
        DEPLOYMENTS_DIR: directory,
        CONTRACT_LAUNCHPAD_DEPLOYER: "0xFromEnv",
      });

      expect(config.contracts.launchpadDeployer).toBe("0xFromEnv");
    });

    it("starts with empty addresses when there is no record", () => {
      const config = loadConfig({
        DEPLOYMENTS_DIR: path.join(directory, "missing"),
        CONTRACT_LAUNCHPAD_DEPLOYER: undefined,
      });

      expect(config.contracts.launchpadDeployer).toBe("");
      expect(config.eventListener.startBlock).toBe(0);
    });

    it("survives a corrupt record rather than failing to boot", () => {
      fs.writeFileSync(path.join(directory, "localhost.json"), "{ not json");

      const config = loadConfig({
        DEPLOYMENTS_DIR: directory,
        CONTRACT_LAUNCHPAD_DEPLOYER: undefined,
      });

      expect(config.contracts.launchpadDeployer).toBe("");
    });
  });

  describe("immutability", () => {
    it("is frozen, so nothing can mutate it at runtime", () => {
      const config = loadConfig();
      expect(Object.isFrozen(config)).toBe(true);
    });
  });
});
