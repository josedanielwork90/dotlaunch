const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createStorageProvider,
  LocalStorageProvider,
  StorageProvider,
} = require("../../../backend/src/services/storage");

/**
 * Storage provider behaviour.
 *
 * The local driver is what makes the whole stack runnable with no external
 * account, so its guarantees matter: content addressing has to be stable
 * (the same document must always yield the same id, or seeded URIs change
 * between runs) and it must not be talked into reading outside its own
 * directory by a content id arriving from an HTTP request.
 */
describe("LocalStorageProvider", () => {
  let directory;
  let provider;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "dotlaunch-storage-"));
    provider = new LocalStorageProvider({
      directory,
      publicBaseUrl: "http://localhost:8888/api/v1/storage",
    });
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  describe("content addressing", () => {
    it("returns the same id for the same document", async () => {
      const document = { name: "Nova", symbol: "NOVA" };

      const first = await provider.putJSON(document);
      const second = await provider.putJSON(document);

      expect(first.cid).toBe(second.cid);
    });

    it("ignores key order, so equivalent documents share an id", async () => {
      const a = await provider.putJSON({ name: "Nova", symbol: "NOVA" });
      const b = await provider.putJSON({ symbol: "NOVA", name: "Nova" });

      expect(a.cid).toBe(b.cid);
    });

    it("canonicalises nested objects, not just the top level", async () => {
      const a = await provider.putJSON({
        meta: { b: 2, a: 1 },
        tags: ["x", "y"],
      });
      const b = await provider.putJSON({
        tags: ["x", "y"],
        meta: { a: 1, b: 2 },
      });

      expect(a.cid).toBe(b.cid);
    });

    it("preserves array order, which is meaningful", async () => {
      const a = await provider.putJSON({ tags: ["x", "y"] });
      const b = await provider.putJSON({ tags: ["y", "x"] });

      expect(a.cid).not.toBe(b.cid);
    });

    it("gives different documents different ids", async () => {
      const a = await provider.putJSON({ name: "Nova" });
      const b = await provider.putJSON({ name: "Aurora" });

      expect(a.cid).not.toBe(b.cid);
    });
  });

  describe("round trip", () => {
    it("reads back exactly what was written", async () => {
      const document = {
        name: "Nova Protocol",
        socials: { twitter: "@nova" },
        tags: ["DeFi", "Audited"],
        raised: 29.45,
        active: true,
      };

      const { cid } = await provider.putJSON(document);

      expect(await provider.getJSON(cid)).toEqual(document);
    });

    it("accepts a full URL as well as a bare id", async () => {
      const { cid, url } = await provider.putJSON({ name: "Nova" });

      expect(await provider.getJSON(url)).toEqual({ name: "Nova" });
      expect(await provider.getJSON(cid)).toEqual({ name: "Nova" });
    });

    it("returns null for an unknown id rather than throwing", async () => {
      expect(await provider.getJSON("local-does-not-exist")).toBeNull();
    });

    it("returns null for an empty reference", async () => {
      expect(await provider.getJSON("")).toBeNull();
      expect(await provider.getJSON(null)).toBeNull();
    });

    it("rejects an empty document", async () => {
      await expect(provider.putJSON(null)).rejects.toThrow(/empty document/i);
    });
  });

  describe("path traversal", () => {
    /**
     * Content ids arrive straight from the URL. A traversal attempt must not
     * be able to read a file outside the storage directory.
     */
    it("does not read outside the storage directory", async () => {
      const secret = path.join(os.tmpdir(), "dotlaunch-secret.json");
      fs.writeFileSync(secret, JSON.stringify({ secret: true }));

      try {
        const result = await provider.getJSON("../dotlaunch-secret");
        expect(result).toBeNull();
      } finally {
        fs.rmSync(secret, { force: true });
      }
    });

    it("rejects ids containing path separators", () => {
      expect(() => provider.filePath("a/b")).toThrow(/invalid content id/i);
      expect(() => provider.filePath("../escape")).toThrow(/invalid content id/i);
    });

    it("writes only inside its own directory", async () => {
      const { cid } = await provider.putJSON({ name: "Nova" });
      const written = provider.filePath(cid);

      expect(path.dirname(written)).toBe(path.resolve(directory));
    });
  });

  describe("health", () => {
    it("reports healthy for a writable directory", async () => {
      const health = await provider.health();
      expect(health.ok).toBe(true);
    });
  });

  describe("publicUrl", () => {
    it("joins the base and id without doubling the slash", () => {
      const trailing = new LocalStorageProvider({
        directory,
        publicBaseUrl: "http://localhost:8888/api/v1/storage/",
      });

      expect(trailing.publicUrl("local-abc")).toBe(
        "http://localhost:8888/api/v1/storage/local-abc"
      );
    });
  });
});

describe("StorageProvider.extractCid", () => {
  it.each([
    ["http://localhost:8888/api/v1/storage/local-abc", "local-abc"],
    ["https://gateway.pinata.cloud/ipfs/QmHash", "QmHash"],
    ["local-abc", "local-abc"],
    ["http://host/path/local-abc?v=2", "local-abc"],
    ["http://host/path/local-abc/", "local-abc"],
    ["", ""],
    [null, ""],
    [undefined, ""],
    [42, ""],
  ])("extracts %p as %p", (input, expected) => {
    expect(StorageProvider.extractCid(input)).toBe(expected);
  });
});

describe("createStorageProvider", () => {
  it("builds the local driver", () => {
    const provider = createStorageProvider({
      driver: "local",
      localDir: fs.mkdtempSync(path.join(os.tmpdir(), "dotlaunch-factory-")),
      publicBaseUrl: "http://localhost:8888/api/v1/storage",
    });

    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("rejects an unknown driver by name", () => {
    expect(() => createStorageProvider({ driver: "s3" })).toThrow(
      /unknown storage_driver "s3"/i
    );
  });

  /**
   * The Pinata driver is the one place a third-party SDK is used. Selecting
   * it without a credential must fail loudly at startup rather than at the
   * moment a user tries to create a presale.
   */
  it("refuses the pinata driver with no credential", () => {
    expect(() =>
      createStorageProvider({ driver: "pinata", pinataJwt: "" })
    ).toThrow(/requires PINATA_JWT/i);
  });
});

describe("StorageProvider base class", () => {
  it("requires subclasses to implement the interface", async () => {
    class Incomplete extends StorageProvider {}
    const incomplete = new Incomplete();

    await expect(incomplete.putJSON({})).rejects.toThrow(/must implement putJSON/);
    await expect(incomplete.getJSON("x")).rejects.toThrow(/must implement getJSON/);
    expect(() => incomplete.publicUrl("x")).toThrow(/must implement publicUrl/);
  });
});
