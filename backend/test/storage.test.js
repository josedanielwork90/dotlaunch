const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createStorageProvider,
  LocalStorageProvider,
  PinataStorageProvider,
} = require("../src/services/storage");
const StorageProvider = require("../src/services/storage/StorageProvider");

/**
 * Storage drivers.
 *
 * The point of the interface is that nothing above it can tell which driver
 * is in use, so the local driver is tested against the same contract the
 * pinning driver has to satisfy: store a document, get a stable content id
 * back, and read the identical document out again.
 */

const tempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "dotlaunch-storage-"));

describe("createStorageProvider", () => {
  it("builds the local driver by name", () => {
    const provider = createStorageProvider({
      driver: "local",
      localDir: tempDir(),
      publicBaseUrl: "http://localhost:8888/api/v1/storage",
    });

    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("rejects an unknown driver by name", () => {
    expect(() => createStorageProvider({ driver: "carrier-pigeon" })).toThrow(
      /carrier-pigeon/
    );
  });

  it("refuses the pinata driver with no credential", () => {
    expect(() =>
      createStorageProvider({ driver: "pinata", pinataJwt: "" })
    ).toThrow(/PINATA_JWT/);
  });
});

describe("LocalStorageProvider", () => {
  let directory;
  let provider;

  beforeEach(() => {
    directory = tempDir();
    provider = new LocalStorageProvider({
      directory,
      publicBaseUrl: "http://localhost:8888/api/v1/storage",
    });
  });

  it("returns a content id and a url", async () => {
    const stored = await provider.putJSON({ name: "Nova" });

    expect(typeof stored.cid).toBe("string");
    expect(stored.cid.length).toBeGreaterThan(0);
    expect(stored.url).toContain(stored.cid);
  });

  it("reads back exactly what was stored", async () => {
    const document = { name: "Nova", tags: ["defi", "bsc"], decimals: 9 };
    const { cid } = await provider.putJSON(document);

    expect(await provider.getJSON(cid)).toEqual(document);
  });

  it("is content addressed: the same document gets the same id", async () => {
    const first = await provider.putJSON({ name: "Nova" });
    const second = await provider.putJSON({ name: "Nova" });

    expect(second.cid).toBe(first.cid);
  });

  it("gives different documents different ids", async () => {
    const first = await provider.putJSON({ name: "Nova" });
    const second = await provider.putJSON({ name: "Solaris" });

    expect(second.cid).not.toBe(first.cid);
  });

  it("returns null for an id it has never seen", async () => {
    expect(await provider.getJSON("nope")).toBeNull();
  });

  it("creates its directory on demand", async () => {
    const nested = path.join(directory, "deeper", "still");
    const nestedProvider = new LocalStorageProvider({
      directory: nested,
      publicBaseUrl: "http://localhost:8888/api/v1/storage",
    });

    await nestedProvider.putJSON({ name: "Nova" });

    expect(fs.existsSync(nested)).toBe(true);
  });

  it("reports itself healthy once it can write", async () => {
    const health = await provider.health();
    expect(health.ok).toBe(true);
  });
});

describe("StorageProvider.extractCid", () => {
  const CID = "bafybeigdyrztktx5b5m2y4sogf2hf5uq3wnvpcnj6xn5k2pmjw7abc";

  it("passes a bare id through", () => {
    expect(StorageProvider.extractCid(CID)).toBe(CID);
  });

  it("takes the trailing segment of a gateway url", () => {
    expect(
      StorageProvider.extractCid(`https://gateway.pinata.cloud/ipfs/${CID}`)
    ).toBe(CID);
  });

  it("ignores a query string", () => {
    expect(StorageProvider.extractCid(`https://x.invalid/${CID}?a=1`)).toBe(CID);
  });

  it("ignores a trailing slash", () => {
    expect(StorageProvider.extractCid(`https://x.invalid/${CID}/`)).toBe(CID);
  });

  it("returns an empty string for nothing useful", () => {
    expect(StorageProvider.extractCid("")).toBe("");
    expect(StorageProvider.extractCid(undefined)).toBe("");
  });
});

describe("the interface itself", () => {
  it("refuses to be used directly", async () => {
    const bare = new StorageProvider();

    await expect(bare.putJSON({})).rejects.toThrow(/must implement putJSON/);
    await expect(bare.getJSON("x")).rejects.toThrow(/must implement getJSON/);
  });

  it("is what every driver extends", () => {
    expect(LocalStorageProvider.prototype).toBeInstanceOf(StorageProvider);
    expect(PinataStorageProvider.prototype).toBeInstanceOf(StorageProvider);
  });
});
