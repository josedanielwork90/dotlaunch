/**
 * Publishes demo presale metadata through the DotLaunch API.
 *
 * This deliberately uses the *same* path the app's create-launchpad wizard
 * uses - sign in with a wallet signature, POST the campaign, then record the
 * returned campaign URL on chain - rather than writing to storage directly.
 *
 * That matters: seeded presales resolve their metadata exactly the way a
 * user-created one does, through the same endpoint and the same response
 * shape. Anything that works for the demo data works for real data, and a
 * bug in that path shows up while seeding instead of in front of a reviewer.
 *
 * If the API is unreachable the seeder still completes; presales are created
 * with no metadata URI and the UI falls back to on-chain fields.
 */

/** Fields the campaign endpoint accepts. Anything else is rejected by Joi. */
const CAMPAIGN_FIELDS = [
  "description",
  "discord",
  "facebook",
  "github",
  "logo",
  "reddit",
  "telegram",
  "twitter",
  "youtube",
  "updates",
  "website",
];

/**
 * Map a dataset entry onto the campaign schema.
 *
 * The dataset is written for humans (nested `socials`, a `tags` array); the
 * API expects a flat set of strings. Empty values are dropped rather than
 * sent as "", which Joi rejects.
 */
const toCampaignPayload = (metadata) => {
  const socials = metadata.socials || {};
  const candidate = {
    description: metadata.description,
    website: metadata.website,
    logo: metadata.logoUrl || metadata.logo,
    twitter: socials.twitter,
    telegram: socials.telegram,
    discord: socials.discord,
    github: socials.github,
    reddit: socials.reddit,
    facebook: socials.facebook,
    youtube: socials.youtube,
    updates: metadata.updates,
  };

  return CAMPAIGN_FIELDS.reduce((acc, field) => {
    const value = candidate[field];
    if (typeof value === "string" && value.trim() !== "") acc[field] = value;
    return acc;
  }, {});
};

class MetadataClient {
  /**
   * @param {{baseUrl: string, timeoutMs?: number}} options
   */
  constructor({ baseUrl, timeoutMs = 8000 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.available = null;
    /** Bearer tokens per lower-cased address. */
    this.tokens = new Map();
  }

  /** True when the API answered its health check. */
  async probe() {
    if (this.available !== null) return this.available;
    try {
      const response = await this._fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });
      this.available = response.ok;
    } catch (error) {
      this.available = false;
    }
    return this.available;
  }

  /**
   * Authenticate a signer, exactly as the web app does.
   *
   * The API issues a JWT only to someone who can sign a nonce with the
   * address they claim, so the seeder signs with the same wallet that will
   * own the presale.
   */
  async authenticate(signer) {
    const address = await signer.getAddress();
    const key = address.toLowerCase();
    if (this.tokens.has(key)) return this.tokens.get(key);

    const nonce = `DotLaunch demo seed ${Date.now()}`;
    const signature = await signer.signMessage(nonce);

    const response = await this._fetch(`${this.baseUrl}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, nonce, signature, network: "localhost" }),
    });

    if (!response.ok) {
      throw new Error(`Sign-in failed with HTTP ${response.status}`);
    }

    const { token } = await response.json();
    this.tokens.set(key, token);
    return token;
  }

  /**
   * Create a campaign and return the URI to record on chain.
   *
   * @param {string} key Project key, for log output.
   * @param {object} metadata Dataset metadata entry.
   * @param {object} signer Wallet that will own the presale.
   * @returns {Promise<{uri: string, stored: boolean}>}
   */
  async put(key, metadata, signer) {
    if (!(await this.probe())) return { uri: "", stored: false };

    try {
      const token = await this.authenticate(signer);
      const payload = toCampaignPayload(metadata);

      const response = await this._fetch(
        `${this.baseUrl}/launchpads/campaign/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`HTTP ${response.status}: ${detail.slice(0, 160)}`);
      }

      const { opcode } = await response.json();
      // The public URL the browser will fetch. It must be reachable from the
      // browser, not from inside the compose network, so it is built from the
      // externally visible base URL rather than the service hostname.
      const publicBase = (
        process.env.PUBLIC_API_BASE_URL || this.baseUrl
      ).replace(/\/+$/, "");

      return {
        uri: `${publicBase}/launchpads/campaign/get/${opcode}`,
        stored: true,
      };
    } catch (error) {
      return { uri: "", stored: false, error: error.message };
    }
  }

  /** fetch with a timeout, so an unreachable API cannot stall the seeder. */
  async _fetch(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { MetadataClient, toCampaignPayload, CAMPAIGN_FIELDS };
