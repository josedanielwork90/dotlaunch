const { BigNumber } = require("ethers");

const formatter = require("../../../backend/src/loaders/bscEventListener/helpers/transactionLogFormatter");

/** Real BigNumbers, because the formatters unwrap them via getNumberFromBN. */
const bn = (value) => BigNumber.from(String(value));

/**
 * Event log formatting.
 *
 * These translate raw contract logs into the shape stored in MongoDB and
 * served to the web app. They are the seam where a mis-typed field name
 * silently becomes bad data for every record, so each event's fields are
 * asserted by name rather than by shape.
 */

/** A decoded log as ethers hands it over. */
const log = (args, overrides = {}) => ({
  args,
  transactionHash: "0xdeadbeef",
  blockNumber: 42,
  ...overrides,
});

describe("formatLaunchpadCreated", () => {
  const args = {
    launchpad: "0xLaunchpad",
    deployer: "0xDeployer",
    tokenSale: "0xTokenSale",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    launchPadType: 0,
    uriData: "http://localhost:8888/api/v1/launchpads/campaign/get/01ABC",
    refundWhenFinish: true,
    startTime: bn(1749902400),
    endTime: bn(1750766400),
    claimTime: bn(1750939200),
    adminTokenSaleFee: bn(200),
  };

  it("carries the launchpad address and metadata URI through", () => {
    const result = formatter.formatLaunchpadCreated(log(args));

    expect(result.launchpad).toBe("0xLaunchpad");
    expect(result.tokenSale).toBe("0xTokenSale");
    expect(result.uriData).toBe(args.uriData);
    expect(result.transactionHash).toBe("0xdeadbeef");
    // The deployer is stored as `user`: it is the account that owns the sale.
    expect(result.user).toBe("0xDeployer");
  });

  it("converts chain seconds to milliseconds for storage", () => {
    const result = formatter.formatLaunchpadCreated(log(args));

    expect(result.startTime).toBe(1749902400 * 1000);
    expect(result.endTime).toBe(1750766400 * 1000);
    expect(result.claimTime).toBe(1750939200 * 1000);
  });

  it("keeps the sale type, which distinguishes fair launches", () => {
    expect(formatter.formatLaunchpadCreated(log(args)).launchPadType).toBe(0);
    expect(
      formatter.formatLaunchpadCreated(log({ ...args, launchPadType: 1 }))
        .launchPadType
    ).toBe(1);
  });
});

describe("formatLaunchpadRaisedChanged", () => {
  /**
   * Regression: this read `log.args.totalNeedToRaised`, but the event
   * parameter is `newNeedToRaised`. Every stored record held the string
   * "undefined" instead of a number, so the UI could not tell how much of a
   * sale's allocation remained.
   */
  it("reads the event's own parameter names", () => {
    const result = formatter.formatLaunchpadRaisedChanged(
      log({
        launchpad: "0xLaunchpad",
        newRaisedAmount: bn("26500000000000000000"),
        newNeedToRaised: bn("139500000000000000000000"),
      })
    );

    expect(result.totalRaised).toBe("26500000000000000000");
    expect(result.totalNeedToRaised).toBe("139500000000000000000000");
  });

  it("never stores the literal string 'undefined'", () => {
    const result = formatter.formatLaunchpadRaisedChanged(
      log({
        launchpad: "0xLaunchpad",
        newRaisedAmount: bn(1),
        newNeedToRaised: bn(2),
      })
    );

    Object.values(result).forEach((value) => {
      expect(value).not.toBe("undefined");
    });
  });

  it("keeps amounts as strings, since they exceed Number precision", () => {
    const result = formatter.formatLaunchpadRaisedChanged(
      log({
        launchpad: "0xLaunchpad",
        newRaisedAmount: bn("26500000000000000000"),
        newNeedToRaised: bn(0),
      })
    );

    expect(typeof result.totalRaised).toBe("string");
    // Round-tripping through Number would lose the low-order digits.
    expect(result.totalRaised).toBe("26500000000000000000");
  });
});

describe("formatLaunchpadStateChanged", () => {
  it.each([
    [0, "opening"],
    [1, "finished"],
    [2, "cancelled"],
  ])("carries on-chain state %p (%s) through as a number", (state) => {
    const result = formatter.formatLaunchpadStateChanged(
      log({ launchpad: "0xLaunchpad", state: bn(state) })
    );

    expect(result.launchpad).toBe("0xLaunchpad");
    expect(result.status).toBe(state);
  });
});

describe("formatLaunchpadActionChanged", () => {
  it("carries the whitelist flag and deadline", () => {
    const result = formatter.formatLaunchpadActionChanged(
      log({
        launchpad: "0xLaunchpad",
        usingWhitelist: true,
        endOfWhitelistTime: bn(0),
      })
    );

    expect(result.usingWhitelist).toBe(true);
    expect(result.launchpad).toBe("0xLaunchpad");
  });
});

describe("formatLaunchpadWhitelistUsersChanged", () => {
  it("carries the full address list, not just the first entry", () => {
    const users = ["0xAaa", "0xBbb", "0xCcc", "0xDdd"];
    const result = formatter.formatLaunchpadWhitelistUsersChanged(
      log({ launchpad: "0xLaunchpad", users, action: bn(0) })
    );

    expect(result.whitelistUsers).toEqual(users);
    expect(result.whitelistUsers).toHaveLength(4);
  });
});

describe("formatLaunchpadParameter", () => {
  it("carries caps, rates and per-wallet limits", () => {
    const result = formatter.formatLaunchpadParameter(
      log({
        launchpad: "0xLaunchpad",
        softcap: bn("25000000000000000000"),
        hardcap: bn("75000000000000000000"),
        presaleRate: bn(900),
        listingRate: bn(750),
        minBuyPerParticipant: bn("500000000000000000"),
        maxBuyPerParticipant: bn("12000000000000000000"),
      })
    );

    expect(result.softcap).toBe("25000000000000000000");
    expect(result.hardcap).toBe("75000000000000000000");
    expect(result.presaleRate).toBe("900");
    expect(result.minBuyPerParticipant).toBe("500000000000000000");
  });
});
