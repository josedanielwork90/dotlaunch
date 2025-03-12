/**
 * Content-addressed storage: the interface every driver implements.
 *
 * Presale metadata (logo, description, socials, whitepaper links) is stored
 * off-chain and referenced on-chain by URI. In production that is IPFS; for
 * local development and tests it is the filesystem. Both satisfy this
 * contract, so nothing above this layer knows or cares which is in use.
 *
 * All third-party storage SDK usage in this codebase lives behind this
 * interface, in `PinataStorageProvider`. Swapping providers is a config
 * change, not a code change.
 */
class StorageProvider {
  /**
   * Persist a JSON document and return a stable reference to it.
   *
   * @param {object} document Any JSON-serialisable value.
   * @param {{name?: string}} [options] Optional human-readable label.
   * @returns {Promise<{cid: string, url: string}>} Content id and public URL.
   */
  // eslint-disable-next-line no-unused-vars
  async putJSON(document, options = {}) {
    throw new Error(`${this.constructor.name} must implement putJSON()`);
  }

  /**
   * Read back a document previously stored by this provider.
   *
   * @param {string} cid Content id returned by putJSON.
   * @returns {Promise<object|null>} The document, or null if unknown.
   */
  // eslint-disable-next-line no-unused-vars
  async getJSON(cid) {
    throw new Error(`${this.constructor.name} must implement getJSON()`);
  }

  /**
   * Public URL for a content id.
   *
   * @param {string} cid
   * @returns {string}
   */
  // eslint-disable-next-line no-unused-vars
  publicUrl(cid) {
    throw new Error(`${this.constructor.name} must implement publicUrl()`);
  }

  /**
   * Whether this provider can serve requests right now.
   *
   * Surfaced by the health endpoint so a misconfigured pinning service shows
   * up as a degraded API rather than as failures at presale-creation time.
   *
   * @returns {Promise<{ok: boolean, detail?: string}>}
   */
  async health() {
    return { ok: true };
  }

  /**
   * Extract the content id from a stored URI.
   *
   * Historic records hold full gateway URLs rather than bare ids, so this
   * accepts either and returns the trailing path segment.
   *
   * @param {string} uri
   * @returns {string}
   */
  static extractCid(uri) {
    if (typeof uri !== "string" || uri === "") return "";
    const withoutQuery = uri.split("?")[0].replace(/\/+$/, "");
    const segments = withoutQuery.split("/");
    return segments[segments.length - 1] || "";
  }
}

module.exports = StorageProvider;
