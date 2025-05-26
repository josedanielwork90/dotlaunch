/**
 * Chain event indexing.
 *
 * The listener pulls logs off the chain, formats them, and hands them to
 * these handlers, which are the only writers of the `launchpadInfo`
 * collection the API then serves. Two properties matter more than anything
 * else here:
 *
 *   - indexing is idempotent. The listener replays overlapping block ranges
 *     on every restart, so a log delivered twice must not create a second
 *     record or double a raised total.
 *   - later events never resurrect a record that was never created. Parameter
 *     and raised-amount events for an unknown presale are dropped rather than
 *     upserted into a half-built document the UI cannot render.
 *
 * These need a database. `docker compose run --rm test` provides one.
 */

const dispatch = require("../../../backend/src/events/handlers/bsc");
const models = require("../../../backend/src/models");
const mongoLoader = require("../../../backend/src/loaders/mongo");
const {
  BSC_EVENT_NAME,
  LAUNCHPAD_ONCHAIN_STATUS,
} = require("../../../backend/src/helpers/constants");

const LAUNCHPAD = "0x00000000000000000000000000000000000000a1";
const OTHER = "0x00000000000000000000000000000000000000a2";
const UNKNOWN = "0x00000000000000000000000000000000000000ff";

const awaitMongo = async () => {
  const connection = mongoLoader();
  if (connection.readyState === 1) return;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Could not reach MongoDB at ${process.env.MONGO_URL}. ` +
              `Integration tests need a database: run them with ` +
              `\`docker compose run --rm test\`.`
          )
        ),
      15000
    );
    connection.once("connected", () => {
      clearTimeout(timer);
      resolve();
    });
    connection.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

/** Feed one batch of formatted events through the queue handler. */
const deliver = (eventType, eventData) =>
  dispatch({ data: { eventType, eventData } });

/** A formatted launchpadDeployed log, as the formatter produces one. */
const createdEvent = (overrides = {}) => ({
  user: "0x0000000000000000000000000000000000000b01",
  tokenSale: "0x0000000000000000000000000000000000000c01",
  tokenPayment: "0x0000000000000000000000000000000000000000",
  launchpad: LAUNCHPAD,
  launchPadType: 0,
  uriData: "https://example.invalid/metadata/1",
  refundWhenFinish: true,
  startTime: 1_749_000_000_000,
  endTime: 1_750_000_000_000,
  claimTime: 1_750_100_000_000,
  transactionHash: "0xhash1",
  adminTokenSaleFee: "5000",
  ...overrides,
});

describe("event indexing", () => {
  beforeAll(async () => {
    await awaitMongo();
  });

  beforeEach(async () => {
    await models.launchpadInfo.deleteMany({
      launchpad: { $in: [LAUNCHPAD, OTHER, UNKNOWN] },
    });
  });

  afterAll(async () => {
    await models.launchpadInfo.deleteMany({
      launchpad: { $in: [LAUNCHPAD, OTHER, UNKNOWN] },
    });
    await mongoLoader.close();
  });

  const find = (launchpad = LAUNCHPAD) =>
    models.launchpadInfo.findOne({ launchpad });

  describe("launchpadDeployed", () => {
    it("creates a record for a newly deployed presale", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);

      const stored = await find();
      expect(stored).not.toBeNull();
      expect(stored.launchpad).toBe(LAUNCHPAD);
      expect(stored.uriData).toBe("https://example.invalid/metadata/1");
    });

    it("opens the presale in the OPENING state", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);

      const stored = await find();
      expect(String(stored.status)).toBe(
        String(LAUNCHPAD_ONCHAIN_STATUS.OPENING)
      );
    });

    it("defaults kyc and audit to false", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);

      const stored = await find();
      expect(stored.kyc).toBe(false);
      expect(stored.audit).toBe(false);
    });

    it("indexes a batch of presales in one delivery", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [
        createdEvent(),
        createdEvent({ launchpad: OTHER, transactionHash: "0xhash2" }),
      ]);

      expect(await find()).not.toBeNull();
      expect(await find(OTHER)).not.toBeNull();
    });

    /**
     * The listener replays overlapping ranges after a restart, so the same
     * log arrives more than once as a matter of course.
     */
    it("is idempotent when the same log is replayed", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);

      const all = await models.launchpadInfo.find({ launchpad: LAUNCHPAD });
      expect(all).toHaveLength(1);
    });

    it("does not overwrite an existing record on replay", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [
        createdEvent({ uriData: "https://example.invalid/changed" }),
      ]);

      const stored = await find();
      expect(stored.uriData).toBe("https://example.invalid/metadata/1");
    });

    it("accepts an empty batch", async () => {
      await expect(
        deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [])
      ).resolves.toBeTruthy();
    });
  });

  describe("launchpadDeployedParameter", () => {
    const parameterEvent = (overrides = {}) => ({
      launchpad: LAUNCHPAD,
      softcap: "20000000000000000",
      hardcap: "50000000000000000",
      presaleRate: "100000",
      listingRate: "90000",
      minBuyPerParticipant: "1000000000000000",
      maxBuyPerParticipant: "100000000000000000",
      transactionHash: "0xhash3",
      ...overrides,
    });

    it("attaches sale parameters to an indexed presale", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, [parameterEvent()]);

      const stored = await find();
      expect(stored.softcap).toBe("20000000000000000");
      expect(stored.hardcap).toBe("50000000000000000");
      expect(stored.presaleRate).toBe("100000");
    });

    it("leaves the creation fields intact", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, [parameterEvent()]);

      const stored = await find();
      expect(stored.uriData).toBe("https://example.invalid/metadata/1");
      expect(stored.launchPadType).toBe(0);
    });

    it("ignores parameters for a presale that was never indexed", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, [
        parameterEvent({ launchpad: UNKNOWN }),
      ]);

      expect(await find(UNKNOWN)).toBeNull();
    });

    it("is idempotent when replayed", async () => {
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_CREATED, [createdEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, [parameterEvent()]);
      await deliver(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, [parameterEvent()]);

      const all = await models.launchpadInfo.find({ launchpad: LAUNCHPAD });
      expect(all).toHaveLength(1);
      expect(all[0].softcap).toBe("20000000000000000");
    });
  });

});
