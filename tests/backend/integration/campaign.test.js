/**
 * Campaign persistence.
 *
 * A campaign is the off-chain half of a presale: the description, logo and
 * social links a project fills in before the sale contract exists. It is
 * keyed by an opcode the API mints, and it is editable — but only by the
 * address that created it, which is the part worth testing properly, since
 * ownership is the only thing preventing one project from rewriting another
 * project's listing.
 *
 * These tests need a database. `docker compose run --rm test` provides one.
 */

const CampaignService = require("../../../backend/src/api/v1/services/campaign");
const models = require("../../../backend/src/models");
const mongoLoader = require("../../../backend/src/loaders/mongo");

const OWNER = "0xAbC0000000000000000000000000000000000001";
const STRANGER = "0xdEf0000000000000000000000000000000000002";

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

/** A complete campaign body, as the create form submits it. */
const campaignBody = (overrides = {}) => ({
  owner: OWNER,
  description: "A community-owned index of BSC blue chips.",
  logo: "https://example.invalid/logo.png",
  website: "https://example.invalid",
  twitter: "https://twitter.com/example",
  telegram: "https://t.me/example",
  discord: "",
  github: "",
  reddit: "",
  youtube: "",
  facebook: "",
  updates: "",
  ...overrides,
});

describe("CampaignService", () => {
  let service;
  const created = [];

  beforeAll(async () => {
    await awaitMongo();
    service = new CampaignService();
  });

  afterAll(async () => {
    if (created.length) {
      await models.launchpadCampaign.deleteMany({ opcode: { $in: created } });
    }
    await mongoLoader.close();
  });

  /** Create a campaign and remember it for cleanup. */
  const create = async (overrides) => {
    const [ok, opcode] = await service.createNewCampaign({
      campaignData: campaignBody(overrides),
    });
    if (opcode) created.push(opcode);
    return [ok, opcode];
  };

  describe("createNewCampaign", () => {
    it("stores the campaign and returns a fresh opcode", async () => {
      const [ok, opcode] = await create();

      expect(ok).toBe(true);
      expect(typeof opcode).toBe("string");
      expect(opcode.length).toBeGreaterThan(0);
    });

    it("mints a distinct opcode per campaign", async () => {
      const [, first] = await create();
      const [, second] = await create();

      expect(first).not.toBe(second);
    });

    it("round-trips every field it was given", async () => {
      const [, opcode] = await create({
        description: "Round trip check",
        twitter: "https://twitter.com/roundtrip",
      });

      const stored = await service.getCampaign({ opcode });

      expect(stored.description).toBe("Round trip check");
      expect(stored.twitter).toBe("https://twitter.com/roundtrip");
      expect(stored.owner).toBe(OWNER);
    });

    it("records the opcode on the document itself", async () => {
      const [, opcode] = await create();
      const stored = await service.getCampaign({ opcode });

      expect(stored.opcode).toBe(opcode);
    });
  });

});
