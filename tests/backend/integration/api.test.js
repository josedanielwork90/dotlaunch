const request = require("supertest");
const { Wallet } = require("ethers");

/**
 * API integration tests.
 *
 * These drive the real Express app against a real MongoDB, so they cover the
 * routing, validation, authentication and persistence layers together rather
 * than mocking the parts where the bugs actually live.
 *
 * They need a database. `docker compose run --rm test` provides one; running
 * jest directly against a machine with no MongoDB will fail these with a
 * clear message rather than passing vacuously.
 */

const createApp = require("../../../backend/src/createApp");
const mongoLoader = require("../../../backend/src/loaders/mongo");

let app;

/** Wait for the shared connection to come up, or fail with an explanation. */
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

beforeAll(async () => {
  app = createApp();
  await awaitMongo();
});

afterAll(async () => {
  await mongoLoader.close();
});

describe("GET /api/v1/health", () => {
  it("reports each dependency separately", async () => {
    const response = await request(app).get("/api/v1/health");

    expect([200, 503]).toContain(response.status);
    expect(response.body.checks).toHaveProperty("mongo");
    expect(response.body.checks).toHaveProperty("storage");
    expect(response.body.checks).toHaveProperty("chain");
  });

  it("reports mongo as connected once the database is up", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.body.checks.mongo.ok).toBe(true);
  });

  /**
   * Liveness must not depend on anything external, or an outage in a
   * downstream service causes the orchestrator to restart a healthy process.
   */
  it("answers liveness without touching dependencies", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
