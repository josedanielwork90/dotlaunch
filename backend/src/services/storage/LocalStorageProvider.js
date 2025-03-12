const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const StorageProvider = require("./StorageProvider");

/**
 * Filesystem-backed storage.
 *
 * The default driver. It keeps the whole stack runnable with no internet
 * access and no third-party account, which is what lets the test suite and a
 * fresh `docker compose up` work identically on any machine.
 *
 * Documents are addressed by the SHA-256 of their canonical JSON, so the
 * same content always yields the same id — the same property IPFS gives, and
 * the reason seeded data produces stable URIs across runs.
 */
class LocalStorageProvider extends StorageProvider {
  /**
   * @param {{directory: string, publicBaseUrl: string}} options
   */
  constructor({ directory, publicBaseUrl }) {
    super();
    this.directory = path.resolve(directory);
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
    fsSync.mkdirSync(this.directory, { recursive: true });
  }

  /**
   * Canonical JSON: object keys sorted recursively.
   *
   * Without this, two documents differing only in key order would hash
   * differently and be stored twice under different ids.
   */
  static canonicalise(value) {
    if (Array.isArray(value)) {
      return value.map((item) => LocalStorageProvider.canonicalise(item));
    }
    if (value !== null && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          acc[key] = LocalStorageProvider.canonicalise(value[key]);
          return acc;
        }, {});
    }
    return value;
  }

  /** Content id for a document: "local-" plus the first 46 hex of its digest. */
  static contentId(document) {
    const canonical = JSON.stringify(
      LocalStorageProvider.canonicalise(document)
    );
    const digest = crypto.createHash("sha256").update(canonical).digest("hex");
    return `local-${digest.slice(0, 46)}`;
  }

  /**
   * Absolute path for a content id.
   *
   * @throws if the id contains path separators — it arrives from HTTP
   *         requests, and joining it unchecked would allow traversal out of
   *         the storage directory.
   */
  filePath(cid) {
    if (!/^[A-Za-z0-9_-]+$/.test(cid)) {
      throw new Error(`Invalid content id: ${cid}`);
    }
    return path.join(this.directory, `${cid}.json`);
  }

  async putJSON(document, options = {}) {
    if (document === undefined || document === null) {
      throw new Error("Cannot store an empty document");
    }

    const cid = LocalStorageProvider.contentId(document);
    const payload = {
      name: options.name || null,
      storedAt: new Date().toISOString(),
      content: document,
    };

    await fs.writeFile(
      this.filePath(cid),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );

    return { cid, url: this.publicUrl(cid) };
  }

  async getJSON(cid) {
    const id = StorageProvider.extractCid(cid);
    if (!id) return null;

    try {
      const raw = await fs.readFile(this.filePath(id), "utf8");
      const parsed = JSON.parse(raw);
      // Documents written before the envelope was introduced are stored bare.
      return parsed && parsed.content !== undefined ? parsed.content : parsed;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  publicUrl(cid) {
    return `${this.publicBaseUrl}/${cid}`;
  }

  async health() {
    try {
      await fs.access(this.directory, fsSync.constants.W_OK);
      return { ok: true, detail: `writable at ${this.directory}` };
    } catch (error) {
      return { ok: false, detail: `not writable: ${error.message}` };
    }
  }
}

module.exports = LocalStorageProvider;
