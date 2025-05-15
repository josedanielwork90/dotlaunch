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
