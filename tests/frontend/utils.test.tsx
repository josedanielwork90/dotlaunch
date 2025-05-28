import { BigNumber, utils as ethersUtils } from "ethers";

import {
  shortenAddress,
  formatTimeStamp,
  formatNumberToCurrencyString,
  getNumberFromBN,
  getTokenNumberFromBN,
  getUTCTimestamp,
  getBNFromToken,
  getSaleStatus,
  getValidYoutubeLink,
  makeString,
} from "../../frontend/src/utils";
import { reloadRuntimeConfig } from "../../frontend/src/utils/runtimeConfig";

/**
 * Presentation and conversion helpers.
 *
 * `getSaleStatus` is the interesting one: it is what decides the badge on
 * every presale card, and it derives that from the *application* clock. When
 * it read `Date.now()` directly, a seeded demo environment - whose chain is
 * pinned to a fixed instant - rendered every sale as long finished.
 */

const FIXED_NOW = "2025-06-15T12:00:00Z";
const NOW = Date.parse(FIXED_NOW);
const DAY = 24 * 60 * 60 * 1000;

/** Pin the app clock, as the seeded environment does. */
const freezeClock = (instant: string | null) => {
  (window as any).__DOTLAUNCH_CONFIG__ = { fixedNow: instant };
  reloadRuntimeConfig();
};

/** A presale as the list view models it. */
const pool = (overrides: any = {}) => ({
  status: 0,
  startDate: NOW - DAY,
  endDate: NOW + DAY,
  softCap: "100",
  totalDeposits: "10",
  ...overrides,
});

afterEach(() => {
  delete (window as any).__DOTLAUNCH_CONFIG__;
  reloadRuntimeConfig();
});

describe("shortenAddress", () => {
  it("keeps the first six and last four characters", () => {
    expect(shortenAddress("0xAB1954B077a42564c1bade161163C336D3AFbc6a")).toBe(
      "0xAB19....bc6a"
    );
  });

  it("is stable for the same address", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    expect(shortenAddress(address)).toBe(shortenAddress(address));
  });

  it("distinguishes addresses that share a prefix", () => {
    const a = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1111";
    const b = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2222";
    expect(shortenAddress(a)).not.toBe(shortenAddress(b));
  });
});

describe("number formatting", () => {
  it("formats a timestamp as epoch milliseconds", () => {
    expect(formatTimeStamp("2025-06-15T12:00:00Z")).toBe(NOW);
  });

  it("groups thousands in a currency string", () => {
    expect(formatNumberToCurrencyString(1234567)).toMatch(/1\D?234\D?567/);
  });

  it("leaves a small number ungrouped", () => {
    expect(formatNumberToCurrencyString(12)).toBe("12");
  });

  it("converts an ISO string to whole UTC seconds", () => {
    expect(getUTCTimestamp("2025-06-15T12:00:00Z")).toBe(NOW / 1000);
  });

  it("rounds sub-second precision to the nearest second", () => {
    expect(getUTCTimestamp("2025-06-15T12:00:00.600Z")).toBe(NOW / 1000 + 1);
  });
});

describe("BigNumber conversion", () => {
  it("unwraps a BigNumber to a number", () => {
    expect(getNumberFromBN(BigNumber.from(4200))).toBe(4200);
  });

  it("passes a plain number through", () => {
    expect(getNumberFromBN(7 as any)).toBe(7);
  });

  it("formats token units using the token's decimals", () => {
    const raw = ethersUtils.parseUnits("125.5", 9);
    expect(getTokenNumberFromBN(raw, 9)).toBe("125.5");
  });

  it("defaults to 18 decimals when none are supplied", () => {
    const raw = ethersUtils.parseUnits("2", 18);
    expect(getTokenNumberFromBN(raw, 0)).toBe("2.0");
  });

  it("parses a token amount back into base units", () => {
    expect(getBNFromToken("1.25", 8).toString()).toBe("125000000");
  });

  it("round-trips an amount through parse and format", () => {
    const amount = "913.125";
    expect(getTokenNumberFromBN(getBNFromToken(amount, 18), 18)).toBe(amount);
  });

  it("handles a supply larger than Number.MAX_SAFE_INTEGER", () => {
    const supply = getBNFromToken("1000000000", 18);
    expect(getTokenNumberFromBN(supply, 18)).toBe("1000000000.0");
  });
});

describe("getSaleStatus", () => {
  beforeEach(() => freezeClock(FIXED_NOW));

  it("reports a sale whose window contains now as active", () => {
    expect(getSaleStatus(pool() as any)).toBe(3);
  });

  it("reports a sale that has not opened yet as upcoming", () => {
    expect(
      getSaleStatus(pool({ startDate: NOW + DAY, endDate: NOW + 2 * DAY }) as any)
    ).toBe(0);
  });

  it("reports a closed sale that reached its soft cap as ended", () => {
    expect(
      getSaleStatus(
        pool({
          startDate: NOW - 3 * DAY,
          endDate: NOW - DAY,
          softCap: "100",
          totalDeposits: "150",
        }) as any
      )
    ).toBe(4);
  });

  it("reports a closed sale that missed its soft cap as failed", () => {
    expect(
      getSaleStatus(
        pool({
          startDate: NOW - 3 * DAY,
          endDate: NOW - DAY,
          softCap: "100",
          totalDeposits: "40",
        }) as any
      )
    ).toBe(5);
  });

  it("treats exactly meeting the soft cap as a success", () => {
    expect(
      getSaleStatus(
        pool({
          startDate: NOW - 3 * DAY,
          endDate: NOW - DAY,
          softCap: "100",
          totalDeposits: "100",
        }) as any
      )
    ).toBe(4);
  });

  it("passes an explicitly finished sale straight through", () => {
    expect(getSaleStatus(pool({ status: 1 }) as any)).toBe(1);
  });

  it("passes a cancelled sale straight through", () => {
    expect(getSaleStatus(pool({ status: 2 }) as any)).toBe(2);
  });

  it("counts a sale opening exactly now as active", () => {
    expect(getSaleStatus(pool({ startDate: NOW, endDate: NOW + DAY }) as any)).toBe(3);
  });

  it("counts a sale closing exactly now as still active", () => {
    expect(getSaleStatus(pool({ startDate: NOW - DAY, endDate: NOW }) as any)).toBe(3);
  });

  /**
   * The regression this whole clock indirection exists for: with the system
   * clock, every sale seeded around the fixed instant reads as long closed.
   */
  it("derives state from the pinned instant, not the system clock", () => {
    freezeClock("2020-01-01T00:00:00Z");
    expect(getSaleStatus(pool() as any)).toBe(0);

    freezeClock(FIXED_NOW);
    expect(getSaleStatus(pool() as any)).toBe(3);
  });

  it("falls back to the system clock when nothing is pinned", () => {
    freezeClock(null);
    const live = pool({ startDate: Date.now() - DAY, endDate: Date.now() + DAY });
    expect(getSaleStatus(live as any)).toBe(3);
  });
});

describe("getValidYoutubeLink", () => {
  it("rewrites a watch URL into an embed URL", () => {
    expect(getValidYoutubeLink("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123"
    );
  });

  it("leaves an already-embeddable URL alone", () => {
    const embed = "https://www.youtube.com/embed/abc123";
    expect(getValidYoutubeLink(embed)).toBe(embed);
  });

  it("leaves an unrelated URL alone", () => {
    expect(getValidYoutubeLink("https://example.invalid/video")).toBe(
      "https://example.invalid/video"
    );
  });
});

describe("makeString", () => {
  it("returns a string of the requested length", () => {
    expect(makeString(16)).toHaveLength(16);
  });

  it("returns an empty string for a length of zero", () => {
    expect(makeString(0)).toBe("");
  });

  it("uses only alphanumeric characters", () => {
    expect(makeString(64)).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("does not repeat itself between calls", () => {
    expect(makeString(32)).not.toBe(makeString(32));
  });
});
