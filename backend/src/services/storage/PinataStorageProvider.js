const StorageProvider = require("./StorageProvider");

/**
 * IPFS storage via Pinata.
 *
 * This file is the *only* place in the codebase that touches a third-party
 * storage SDK. It is opt-in (STORAGE_DRIVER=pinata) and never used by the
 * default local stack or the test suite, so the application runs end to end
 * with no external account and no network access.
 *
 * The SDK is required lazily, inside the constructor, so that neither the
 * dependency nor a missing credential can break startup for the local driver.
 */
class PinataStorageProvider extends StorageProvider {
  /**
   * @param {{jwt: string, gatewayUrl: string}} options
   */
  constructor({ jwt, gatewayUrl }) {
    super();

    if (!jwt) {
      throw new Error(
        'STORAGE_DRIVER="pinata" requires PINATA_JWT to be set. ' +
          'Use STORAGE_DRIVER="local" to run without a pinning service.'
      );
    }

    // eslint-disable-next-line global-require
    const PinataSDK = require("@pinata/sdk");

    this.gatewayUrl = gatewayUrl.replace(/\/+$/, "");
    this.client = new PinataSDK({ pinataJWTKey: jwt });
  }

  async putJSON(document, options = {}) {
    const { IpfsHash } = await this.client.pinJSONToIPFS(document, {
      pinataMetadata: options.name ? { name: options.name } : undefined,
    });

    return { cid: IpfsHash, url: this.publicUrl(IpfsHash) };
  }

  async getJSON(cid) {
    const id = StorageProvider.extractCid(cid);
    if (!id) return null;

    const response = await fetch(this.publicUrl(id));
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `IPFS gateway returned ${response.status} for ${id}`
      );
    }
    return response.json();
  }

  publicUrl(cid) {
    return `${this.gatewayUrl}/${cid}`;
  }

  async health() {
    try {
      await this.client.testAuthentication();
      return { ok: true, detail: "pinata authenticated" };
    } catch (error) {
      return { ok: false, detail: `pinata unreachable: ${error.message}` };
    }
  }
}

module.exports = PinataStorageProvider;
