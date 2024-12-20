const { BigNumber } = require("ethers");

const helpers = require("../src/loaders/bscEventListener/helpers");

/**
 * Log formatting.
 *
 * Formatters sit between ethers and MongoDB. Everything arriving from a log
 * is a BigNumber or a checksummed address; everything leaving has to be a
 * plain JSON value that survives a round trip through the database. Getting a
 * field name wrong here does not throw - it stores the string "undefined",
 * which is why these tests assert on shapes rather than just on truthiness.
 */

const bn = (value) => BigNumber.from(value);

/** A launchpadDeployed log as ethers hands it over. */
const deployedLog = (overrides = {}) => ({
  transactionHash: "0xdeadbeef",
  args: {
    deployer: "0x0000000000000000000000000000000000000b01",
    tokenSale: "0x0000000000000000000000000000000000000c01",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    launchpad: "0x00000000000000000000000000000000000000a1",
    launchPadType: bn(0),
    uriData: "https://example.invalid/meta",
    refundWhenFinish: true,
    startTime: bn(1_700_000_000),
    endTime: bn(1_700_086_400),
    claimTime: bn(1_700_172_800),
    adminTokenSaleFee: bn(5000),
    ...overrides,
  },
});

describe("formatLaunchpadCreated", () => {
  it("carries the launchpad address through", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    expect(formatted.launchpad).toBe("0x00000000000000000000000000000000000000a1");
  });

  it("converts chain seconds to milliseconds", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    expect(formatted.startTime).toBe(1_700_000_000_000);
    expect(formatted.endTime).toBe(1_700_086_400_000);
  });

  it("stores the sale type as a number", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    expect(formatted.launchPadType).toBe(0);
    expect(typeof formatted.launchPadType).toBe("number");
  });

  it("stores the admin fee as a string, so precision survives", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    expect(formatted.adminTokenSaleFee).toBe("5000");
  });

  it("keeps the transaction hash", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    expect(formatted.transactionHash).toBe("0xdeadbeef");
  });

  it("produces only JSON-safe values", () => {
    const formatted = helpers.formatLaunchpadCreated(deployedLog());
    for (const value of Object.values(formatted)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
  });
});

describe("formatLaunchpadParameter", () => {
  const parameterLog = {
    transactionHash: "0xfeed",
    args: {
      launchpad: "0x00000000000000000000000000000000000000a1",
      softcap: bn("20000000000000000"),
      hardcap: bn("50000000000000000"),
      presaleRate: bn(100000),
      listingRate: bn(90000),
      minBuyPerParticipant: bn("1000000000000000"),
      maxBuyPerParticipant: bn("100000000000000000"),
    },
  };

  it("keeps wei amounts as strings rather than numbers", () => {
    const formatted = helpers.formatLaunchpadParameter(parameterLog);
    expect(formatted.softcap).toBe("20000000000000000");
    expect(typeof formatted.hardcap).toBe("string");
  });

  it("does not lose precision on a hardcap beyond MAX_SAFE_INTEGER", () => {
    const formatted = helpers.formatLaunchpadParameter({
      ...parameterLog,
      args: { ...parameterLog.args, hardcap: bn("123456789012345678901234") },
    });
    expect(formatted.hardcap).toBe("123456789012345678901234");
  });

  it("carries both rates", () => {
    const formatted = helpers.formatLaunchpadParameter(parameterLog);
    expect(formatted.presaleRate).toBe("100000");
    expect(formatted.listingRate).toBe("90000");
  });
});

describe("formatLaunchpadStateChanged", () => {
  it("converts the state to a number", () => {
    const formatted = helpers.formatLaunchpadStateChanged({
      transactionHash: "0xabc",
      args: {
        launchpad: "0x00000000000000000000000000000000000000a1",
        state: bn(1),
      },
    });
    expect(formatted.status).toBe(1);
  });
});
