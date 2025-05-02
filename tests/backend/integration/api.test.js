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

describe("storage routes", () => {
  it("stores a document and serves it back", async () => {
    const content = { name: "Nova Protocol", tags: ["DeFi"] };

    const created = await request(app)
      .post("/api/v1/storage")
      .send({ name: "nova", content });

    expect(created.status).toBe(201);
    expect(created.body.cid).toBeTruthy();

    const fetched = await request(app).get(
      `/api/v1/storage/${created.body.cid}`
    );

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(content);
  });

  it("returns the same id for identical content", async () => {
    const content = { name: "Aurora", symbol: "AURA" };

    const first = await request(app)
      .post("/api/v1/storage")
      .send({ content });
    const second = await request(app)
      .post("/api/v1/storage")
      .send({ content });

    expect(first.body.cid).toBe(second.body.cid);
  });

  it("rejects a request with no content", async () => {
    const response = await request(app).post("/api/v1/storage").send({});
    expect(response.status).toBe(400);
  });

  it("404s an unknown document", async () => {
    const response = await request(app).get("/api/v1/storage/local-missing");
    expect(response.status).toBe(404);
  });

  it("marks stored documents immutable, since they are content-addressed", async () => {
    const created = await request(app)
      .post("/api/v1/storage")
      .send({ content: { name: "Cache test" } });

    const fetched = await request(app).get(
      `/api/v1/storage/${created.body.cid}`
    );

    expect(fetched.headers["cache-control"]).toContain("immutable");
  });
});

describe("authentication", () => {
  const wallet = Wallet.createRandom();

  /**
   * The API must only issue a token to someone who can prove control of the
   * address they claim, by signing a nonce with it.
   */
  it("issues a token for a valid signature", async () => {
    const nonce = "login-nonce-valid";
    const signature = await wallet.signMessage(nonce);

    const response = await request(app).post("/api/v1/auth/sign-in").send({
      address: wallet.address,
      nonce,
      signature,
      network: "localhost",
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
  });

  it("refuses a signature made by a different key", async () => {
    const impostor = Wallet.createRandom();
    const nonce = "login-nonce-impostor";
    const signature = await impostor.signMessage(nonce);

    const response = await request(app).post("/api/v1/auth/sign-in").send({
      address: wallet.address, // claims one address...
      signature, // ...but signed with another key
      nonce,
      network: "localhost",
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("refuses a signature over a different message", async () => {
    const signature = await wallet.signMessage("some other message");

    const response = await request(app).post("/api/v1/auth/sign-in").send({
      address: wallet.address,
      nonce: "the-expected-nonce",
      signature,
      network: "localhost",
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects a malformed request body", async () => {
    const response = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ address: wallet.address });

    expect(response.status).toBe(400);
  });
});
