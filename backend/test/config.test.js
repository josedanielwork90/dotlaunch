const path = require("path");

/**
 * Configuration resolution.
 *
 * Every deployment knob goes through src/config, so the precedence rules and
 * the type coercion are worth pinning down: a port that arrives as the string
 * "8888" and is never parsed will bind, but a block range that stays a string
 * silently breaks the listener's arithmetic.
 */

/** Load a fresh copy of the config with `env` applied over the current one. */
const loadConfigWith = (env) => {
  const original = { ...process.env };
  Object.assign(process.env, env);

  let config;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    config = require(path.join(__dirname, "..", "src", "config"));
  });

  process.env = original;
  return config;
};

describe("config", () => {
  describe("defaults", () => {
    it("uses the local development port", () => {
      expect(loadConfigWith({ PORT: "" }).port).toBe(8888);
    });

    it("uses a local mongo instance", () => {
      expect(loadConfigWith({ MONGO_URL: "" }).mongo.url).toContain("127.0.0.1");
    });

    it("enables the event listener", () => {
      expect(loadConfigWith({ EVENT_LISTENER_ENABLED: "" }).eventListener.enabled).toBe(
        true
      );
    });
  });

  describe("overrides", () => {
    it("takes the port from the environment", () => {
      expect(loadConfigWith({ PORT: "9000" }).port).toBe(9000);
    });

    it("parses the port as a number, not a string", () => {
      expect(typeof loadConfigWith({ PORT: "9000" }).port).toBe("number");
    });

    it("takes the mongo url from the environment", () => {
      const url = "mongodb://db:27017/other";
      expect(loadConfigWith({ MONGO_URL: url }).mongo.url).toBe(url);
    });

    it("parses the block range as a number", () => {
      const config = loadConfigWith({ EVENT_LISTENER_BLOCK_RANGE: "250" });
      expect(config.eventListener.blockRange).toBe(250);
    });
  });

  describe("boolean coercion", () => {
    it.each(["1", "true", "yes", "on", "TRUE"])("reads %s as true", (value) => {
      expect(loadConfigWith({ EVENT_LISTENER_ENABLED: value }).eventListener.enabled).toBe(
        true
      );
    });

    it.each(["0", "false", "no", "off"])("reads %s as false", (value) => {
      expect(loadConfigWith({ EVENT_LISTENER_ENABLED: value }).eventListener.enabled).toBe(
        false
      );
    });
  });

  describe("validation", () => {
    it("rejects a port that is not a number", () => {
      expect(() => loadConfigWith({ PORT: "eighty-eighty" })).toThrow(
        /must be an integer/
      );
    });

    it("refuses to start in production without a signing secret", () => {
      expect(() =>
        loadConfigWith({ NODE_ENV: "production", JWT_SECRET: "" })
      ).toThrow(/JWT_SECRET/);
    });

    it("allows the development default outside production", () => {
      expect(() =>
        loadConfigWith({ NODE_ENV: "development", JWT_SECRET: "" })
      ).not.toThrow();
    });
  });

  describe("immutability", () => {
    it("is frozen, so nothing can reconfigure the process at runtime", () => {
      const config = loadConfigWith({});
      expect(Object.isFrozen(config)).toBe(true);
    });
  });
});
