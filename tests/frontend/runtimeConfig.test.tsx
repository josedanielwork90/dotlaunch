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

});
