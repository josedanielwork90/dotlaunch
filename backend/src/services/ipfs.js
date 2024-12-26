const PinataSDK = require("@pinata/sdk");

const config = require("../config");
const logger = require("../utils/logger").scoped("IPFS");

/**
 * Presale metadata pinning.
 *
 * Logo, description, socials and whitepaper links are too large and too
 * mutable to hold on chain, so they are pinned to IPFS and the presale keeps
 * only the resulting URI.
 */

let client = null;

/**
 * The shared Pinata client.
 *
 * Built lazily so that importing this module in a test does not immediately
 * demand a credential.
 */
const getClient = () => {
  if (client === null) {
    if (!config.ipfs.pinataJwt) {
      throw new Error(
        "PINATA_JWT is not set. Presale metadata cannot be pinned without it."
      );
    }
    client = new PinataSDK({ pinataJWTKey: config.ipfs.pinataJwt });
  }
  return client;
};

const gateway = () => config.ipfs.gatewayUrl.replace(/\/+$/, "");

/**
 * Pin a JSON document and return its gateway URL.
 *
 * @param {object} document
 * @param {string} [name] Human-readable label shown in the Pinata dashboard.
 * @returns {Promise<{hash: string, url: string}>}
 */
const pinJSON = async (document, name) => {
  const { IpfsHash } = await getClient().pinJSONToIPFS(document, {
    pinataMetadata: name ? { name } : undefined,
  });

  logger.info(`Pinned ${name || "document"} as ${IpfsHash}`);

  return { hash: IpfsHash, url: `${gateway()}/${IpfsHash}` };
};

/**
 * Fetch a pinned document back through the gateway.
 *
 * @param {string} hashOrUrl Either a bare CID or a full gateway URL.
 * @returns {Promise<object|null>}
 */
const fetchJSON = async (hashOrUrl) => {
  const hash = extractHash(hashOrUrl);
  if (!hash) return null;

  const response = await fetch(`${gateway()}/${hash}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`IPFS gateway returned ${response.status} for ${hash}`);
  }
  return response.json();
};

/**
 * Pull the CID out of a stored URI.
 *
 * Records written by earlier revisions hold a full gateway URL rather than a
 * bare hash, so both shapes have to resolve.
 *
 * @param {string} uri
 * @returns {string}
 */
const extractHash = (uri) => {
  if (typeof uri !== "string" || uri === "") return "";
  const withoutQuery = uri.split("?")[0].replace(/\/+$/, "");
  const segments = withoutQuery.split("/");
  return segments[segments.length - 1] || "";
};

/** Whether pinning is configured at all. */
const isConfigured = () => Boolean(config.ipfs.pinataJwt);

/** Report whether the pinning service is reachable and the key is valid. */
const health = async () => {
  if (!isConfigured()) {
    return { ok: false, detail: "PINATA_JWT is not set" };
  }
  try {
    await getClient().testAuthentication();
    return { ok: true, detail: "pinata authenticated" };
  } catch (error) {
    return { ok: false, detail: `pinata unreachable: ${error.message}` };
  }
};

/** Drop the memoised client. Used by tests that change the credential. */
const reset = () => {
  client = null;
};

module.exports = {
  pinJSON,
  fetchJSON,
  extractHash,
  isConfigured,
  health,
  reset,
};
