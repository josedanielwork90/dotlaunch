import {
  reloadRuntimeConfig,
  explorerTxUrl,
  explorerAddressUrl,
} from "../../frontend/src/utils/runtimeConfig";

/**
 * Runtime configuration resolution.
 *
 * Every endpoint, contract address and feature flag the app uses comes from
 * here, so the precedence rules matter: an injected value must beat a
 * build-time one, and a missing value must fall back rather than produce
 * `undefined` somewhere deep in a contract call.
 */

/** Replace the injected config for one case. */
const inject = (config: any) => {
  (window as any).__DOTLAUNCH_CONFIG__ = config;
};

describe("runtimeConfig", () => {
  const originalEnv = process.env;

  afterEach(() => {
    delete (window as any).__DOTLAUNCH_CONFIG__;
    process.env = originalEnv;
  });

  describe("precedence", () => {
    it("prefers an injected value over the environment", () => {
      inject({ apiBaseUrl: "http://injected.test/api/v1" });
      expect(reloadRuntimeConfig().apiBaseUrl).toBe("http://injected.test/api/v1");
    });

    it("falls back to a default when nothing is set", () => {
      inject({});
      const config = reloadRuntimeConfig();

      expect(config.apiBaseUrl).toBeTruthy();
      expect(config.chainRpcUrl).toBeTruthy();
      expect(config.chainId).toBe(31337);
    });

    it("treats an empty injected string as unset", () => {
      inject({ apiBaseUrl: "" });
      expect(reloadRuntimeConfig().apiBaseUrl).toBe(
        "http://localhost:8888/api/v1"
      );
    });

    it("survives no injected config at all", () => {
      delete (window as any).__DOTLAUNCH_CONFIG__;
      expect(() => reloadRuntimeConfig()).not.toThrow();
    });
  });

  describe("contract addresses", () => {
    it("reads every address from the injected block", () => {
      inject({
        contracts: {
          deployer: "0xDeployer",
          tokenLock: "0xLock",
          tokenManage: "0xFactory",
          tokenMultisend: "0xMultisend",
        },
      });

      const { contracts } = reloadRuntimeConfig();

      expect(contracts.deployer).toBe("0xDeployer");
      expect(contracts.tokenLock).toBe("0xLock");
      expect(contracts.tokenManage).toBe("0xFactory");
      expect(contracts.tokenMultisend).toBe("0xMultisend");
    });

    it("yields empty strings rather than undefined when absent", () => {
      inject({});
      const { contracts } = reloadRuntimeConfig();

      Object.values(contracts).forEach((address) => {
        expect(typeof address).toBe("string");
      });
    });
  });

  describe("type coercion", () => {
    it("reads a numeric chain id from a string", () => {
      inject({ chainId: "1337" });
      expect(reloadRuntimeConfig().chainId).toBe(1337);
    });

    it("falls back when the chain id is not a number", () => {
      inject({ chainId: "not-a-number" });
      expect(reloadRuntimeConfig().chainId).toBe(31337);
    });

    it.each([
      [true, true],
      ["true", true],
      ["1", true],
      ["yes", true],
      [false, false],
      ["false", false],
      ["0", false],
    ])("reads demoMode %p as %p", (raw, expected) => {
      inject({ demoMode: raw });
      expect(reloadRuntimeConfig().demoMode).toBe(expected);
    });
  });

  describe("the app clock", () => {
    /**
     * With a fixed instant configured, everything time-derived must read it
     * instead of the system clock, or seeded demo data renders as long past.
     */
    it("returns the fixed instant when one is set", () => {
      inject({ fixedNow: "2025-06-15T12:00:00Z" });
      reloadRuntimeConfig();

      // eslint-disable-next-line global-require
      const { now, isClockFrozen } = require("../../frontend/src/utils/runtimeConfig");
      expect(isClockFrozen()).toBe(true);
      expect(now()).toBe(Date.parse("2025-06-15T12:00:00Z"));
    });

    it("is null when no fixed instant is configured", () => {
      inject({});
      expect(reloadRuntimeConfig().fixedNow).toBeNull();
    });

    it("ignores an unparseable instant rather than producing NaN", () => {
      inject({ fixedNow: "not-a-date" });
      reloadRuntimeConfig();

      // eslint-disable-next-line global-require
      const { now } = require("../../frontend/src/utils/runtimeConfig");
      expect(Number.isNaN(now())).toBe(false);
    });
  });

  describe("explorer links", () => {
    it("builds a transaction link", () => {
      expect(explorerTxUrl("0xabc")).toContain("/tx/0xabc");
    });

    it("builds an address link", () => {
      expect(explorerAddressUrl("0xdef")).toContain("/address/0xdef");
    });

    it("does not double the slash when the base has a trailing one", () => {
      expect(explorerTxUrl("0xabc")).not.toContain("//tx/");
    });
  });
});
