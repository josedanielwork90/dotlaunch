const request = require("supertest");

/**
 * Presale status filtering.
 *
 * The list endpoint does not store a "state" — it derives one by comparing
 * each sale's window against the current time, then translates that into a
 * Mongo query. That derivation is easy to get wrong in a way that looks
 * healthy: the endpoint keeps returning 200 with a well-formed page, just
 * with the wrong sales in it.
 *
 * Fixtures below are positioned relative to the application clock rather
 * than the system clock, which is the whole point: the API compared windows
 * against Date.now() while the seeded chain and the web app ran on a pinned
 * instant, so every sale sorted as long finished and both "upcoming" and
 * "active" returned nothing at all.
 */

const createApp = require("../../../backend/src/createApp");
const mongoLoader = require("../../../backend/src/loaders/mongo");
const models = require("../../../backend/src/models");
const clock = require("../../../backend/src/helpers/clock");

const DAY = 24 * 60 * 60 * 1000;

/**
 * The instant the fixtures are positioned around.
 *
 * Deliberately read straight from the environment rather than from the
 * application clock. If the two ever disagree - which is exactly what the
 * regression was, production code on the system clock and data on the
 * pinned one - these fixtures stay put and the assertions below fail.
 */
const PINNED_NOW = Date.parse(process.env.FIXED_NOW);

/** On-chain lifecycle values as stored by the event listener. */
const ONCHAIN = { OPENING: "0", FINISHED: "1", CANCELLED: "2" };

let app;

const awaitMongo = async () => {
  const connection = mongoLoader();
  if (connection.readyState === 1) return;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Could not reach MongoDB at ${process.env.MONGO_URL}. ` +
              `Run integration tests with \`docker compose run --rm test\`.`
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

/**
 * A launchpad record.
 *
 * Windows are expressed in days relative to the pinned instant, so a sale
 * three days out is genuinely upcoming only if the API agrees on what
 * "now" means.
 */
const record = ({ key, startDays, endDays, status, softcap, raised, type = 0 }) => ({
  launchpad: `0xfilter${key}`,
  user: "0xowner",
  tokenSale: `0xtoken${key}`,
  tokenPayment: "0x0000000000000000000000000000000000000000",
  launchPadType: type,
  startTime: PINNED_NOW + startDays * DAY,
  endTime: PINNED_NOW + endDays * DAY,
  claimTime: PINNED_NOW + (endDays + 1) * DAY,
  status,
  softcap,
  hardcap: "100",
  totalRaised: raised,
  transactionHash: `0xhash${key}`,
});

/**
 * One sale per bucket the UI offers.
 *
 * `softcap`/`totalRaised` are compared with $expr, so a closed sale sorts
 * into success or failure purely on whether it cleared its soft cap.
 */
const FIXTURES = [
  // Window entirely in the future.
  record({ key: "upcoming", startDays: 3, endDays: 10, status: ONCHAIN.OPENING, softcap: "10", raised: "0" }),
  // Open right now.
  record({ key: "active", startDays: -2, endDays: 5, status: ONCHAIN.OPENING, softcap: "10", raised: "4" }),
  // Closed above its soft cap but never finalised on chain.
  record({ key: "clearedcap", startDays: -20, endDays: -5, status: ONCHAIN.OPENING, softcap: "10", raised: "40" }),
  // Explicitly finalised on chain.
  record({ key: "finalised", startDays: -30, endDays: -20, status: ONCHAIN.FINISHED, softcap: "10", raised: "50" }),
  // Closed below its soft cap.
  record({ key: "missedcap", startDays: -20, endDays: -5, status: ONCHAIN.OPENING, softcap: "60", raised: "13" }),
  // Cancelled by its owner.
  record({ key: "cancelled", startDays: -25, endDays: -15, status: ONCHAIN.CANCELLED, softcap: "50", raised: "9" }),
];

/** Fetch one status bucket and return the launchpad ids it contains. */
const idsFor = async (status) => {
  const response = await request(app)
    .post("/api/v1/launchpads/list")
    .send({ filter: { status }, size: 50 });

  expect(response.status).toBe(200);
  return response.body.launchpads.map((l) => l.launchpad).sort();
};

beforeAll(async () => {
  // Guard the premise of every assertion below.
  expect(Number.isNaN(PINNED_NOW)).toBe(false);
  expect(clock.isFrozen()).toBe(true);
  expect(clock.now()).toBe(PINNED_NOW);

  app = createApp();
  await awaitMongo();

  await models.launchpadInfo.deleteMany({ launchpad: /^0xfilter/ });
  await models.launchpadInfo.insertMany(FIXTURES);
});

afterAll(async () => {
  await models.launchpadInfo.deleteMany({ launchpad: /^0xfilter/ });
  await mongoLoader.close();
});

describe("launchpad status filter", () => {
  it("returns only sales whose window has not opened for 'upcoming'", async () => {
    expect(await idsFor("upcoming")).toEqual(["0xfilterupcoming"]);
  });

  it("returns only sales currently open for 'active'", async () => {
    expect(await idsFor("active")).toEqual(["0xfilteractive"]);
  });

  it("counts both finalised and soft-cap-clearing sales as 'success'", async () => {
    expect(await idsFor("success")).toEqual([
      "0xfilterclearedcap",
      "0xfilterfinalised",
    ]);
  });

  it("counts both cancelled and soft-cap-missing sales as 'failed'", async () => {
    expect(await idsFor("failed")).toEqual([
      "0xfiltercancelled",
      "0xfiltermissedcap",
    ]);
  });

  /**
   * The regression that motivated these tests: an upcoming sale is only
   * upcoming relative to the clock the rest of the system uses. Comparing
   * against the system clock instead emptied this bucket entirely.
   */
  it("does not leave upcoming and active empty", async () => {
    const upcoming = await idsFor("upcoming");
    const active = await idsFor("active");

    expect(upcoming.length).toBeGreaterThan(0);
    expect(active.length).toBeGreaterThan(0);
  });

  it("places every sale in exactly one bucket", async () => {
    const buckets = await Promise.all(
      ["upcoming", "active", "success", "failed"].map(idsFor)
    );
    const seen = buckets.flat().filter((id) => id.startsWith("0xfilter"));

    expect(seen.sort()).toEqual(FIXTURES.map((f) => f.launchpad).sort());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("returns every fixture when no status filter is given", async () => {
    const response = await request(app)
      .post("/api/v1/launchpads/list")
      .send({ size: 50 });

    const ours = response.body.launchpads.filter((l) =>
      l.launchpad.startsWith("0xfilter")
    );
    expect(ours).toHaveLength(FIXTURES.length);
  });

  it("rejects a status the UI does not offer", async () => {
    const response = await request(app)
      .post("/api/v1/launchpads/list")
      .send({ filter: { status: "somethingelse" }, size: 50 });

    expect(response.status).toBe(400);
  });
});
