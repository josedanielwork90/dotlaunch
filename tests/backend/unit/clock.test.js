/**
 * The application clock.
 *
 * Everything that decides whether a presale is upcoming, live or closed goes
 * through this module. In the seeded demo environment the chain and the web
 * app are pinned to a fixed instant, so if this ever falls back to the system
 * clock the API classifies every seeded sale as long finished and the status
 * filters return nothing. These tests hold that behaviour down.
 */

/** Load a fresh copy of the clock with a specific FIXED_NOW in place. */
const loadClockWith = (fixedNow) => {
  let clock;
  jest.isolateModules(() => {
    const previous = process.env.FIXED_NOW;
    if (fixedNow === undefined) delete process.env.FIXED_NOW;
    else process.env.FIXED_NOW = fixedNow;

    // eslint-disable-next-line global-require
    clock = require("../../../backend/src/helpers/clock");

    if (previous === undefined) delete process.env.FIXED_NOW;
    else process.env.FIXED_NOW = previous;
  });
  return clock;
};

describe("clock", () => {
  describe("with FIXED_NOW set", () => {
    const INSTANT = "2025-06-15T12:00:00Z";
    const EXPECTED = Date.parse(INSTANT);

    it("reports the pinned instant rather than the system time", () => {
      const clock = loadClockWith(INSTANT);
      expect(clock.now()).toBe(EXPECTED);
    });

    it("reports the same instant on every call", () => {
      const clock = loadClockWith(INSTANT);
      const first = clock.now();
      const second = clock.now();
      expect(second).toBe(first);
    });

    it("does not drift with the system clock", () => {
      const clock = loadClockWith(INSTANT);
      const before = clock.now();

      const realNow = Date.now;
      Date.now = () => realNow() + 86_400_000;
      try {
        expect(clock.now()).toBe(before);
      } finally {
        Date.now = realNow;
      }
    });

    it("exposes whole seconds for comparing against chain timestamps", () => {
      const clock = loadClockWith(INSTANT);
      expect(clock.nowSeconds()).toBe(Math.floor(EXPECTED / 1000));
      expect(Number.isInteger(clock.nowSeconds())).toBe(true);
    });

    it("declares itself frozen", () => {
      expect(loadClockWith(INSTANT).isFrozen()).toBe(true);
    });

    it("accepts an instant with a numeric offset", () => {
      const clock = loadClockWith("2025-06-15T14:00:00+02:00");
      expect(clock.now()).toBe(EXPECTED);
    });
  });

  describe("without FIXED_NOW", () => {
    it("follows the system clock", () => {
      const clock = loadClockWith(undefined);
      const before = Date.now();
      const reported = clock.now();
      const after = Date.now();

      expect(reported).toBeGreaterThanOrEqual(before);
      expect(reported).toBeLessThanOrEqual(after);
    });

    it("advances between calls", () => {
      const clock = loadClockWith(undefined);
      const realNow = Date.now;
      let tick = realNow();
      Date.now = () => {
        tick += 1000;
        return tick;
      };
      try {
        expect(clock.now()).toBeLessThan(clock.now());
      } finally {
        Date.now = realNow;
      }
    });

    it("declares itself not frozen", () => {
      expect(loadClockWith(undefined).isFrozen()).toBe(false);
    });

    it("treats an empty value as unset", () => {
      expect(loadClockWith("").isFrozen()).toBe(false);
    });
  });

  describe("with an unparseable FIXED_NOW", () => {
    /**
     * A typo in the environment must not pin the clock to NaN — every sale
     * comparison would then be false and the whole listing would go blank.
     * Falling back to the system clock degrades to "correct but not seeded".
     */
    it("falls back to the system clock rather than producing NaN", () => {
      const clock = loadClockWith("not-a-timestamp");
      expect(Number.isNaN(clock.now())).toBe(false);
      expect(clock.isFrozen()).toBe(false);
    });

    it("still returns integer seconds", () => {
      const clock = loadClockWith("yesterday");
      expect(Number.isInteger(clock.nowSeconds())).toBe(true);
    });
  });
});
