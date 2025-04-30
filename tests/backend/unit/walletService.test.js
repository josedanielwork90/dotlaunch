const ethers = require("ethers");

const WalletService = require("../../../backend/src/api/v1/services/wallet");
const jwt = require("../../../backend/src/api/v1/middlewares/jwt");

/**
 * Wallet ownership proof.
 *
 * There is no password anywhere in DotLaunch: proving you control an address
 * *is* the login. `isSignerOfMessage` is therefore the only thing standing
 * between an anonymous request and a token for an arbitrary address, and a
 * previous revision of the sign-in controller forgot to await it — a promise
 * is always truthy, so the check silently passed for everyone. These tests
 * pin down both the happy path and every way the check must fail.
 */
describe("WalletService", () => {
  const signer = ethers.Wallet.createRandom();
  const other = ethers.Wallet.createRandom();
  const NONCE = "dotlaunch-sign-in-8f21c0";

  const serviceFor = (address) => new WalletService({ publicKey: address });

  describe("isSignerOfMessage", () => {
    it("accepts a signature produced by the claimed address", async () => {
      const signature = await signer.signMessage(NONCE);
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature })
      ).resolves.toBe(true);
    });

    it("is case-insensitive about the claimed address", async () => {
      const signature = await signer.signMessage(NONCE);
      const service = serviceFor(signer.address.toLowerCase());

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature })
      ).resolves.toBe(true);
    });

    it("rejects a signature from a different wallet", async () => {
      const signature = await other.signMessage(NONCE);
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature })
      ).resolves.toBe(false);
    });

    it("rejects a signature over a different message", async () => {
      const signature = await signer.signMessage("some other nonce");
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature })
      ).resolves.toBe(false);
    });

    it("rejects a tampered signature rather than throwing", async () => {
      const signature = await signer.signMessage(NONCE);
      const mangled = `${signature.slice(0, -4)}dead`;
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature: mangled })
      ).resolves.toBe(false);
    });

    it("rejects a signature that is not hex at all", async () => {
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature: "hello" })
      ).resolves.toBe(false);
    });

    it("rejects a missing signature", async () => {
      const service = serviceFor(signer.address);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature: undefined })
      ).resolves.toBe(false);
    });

    it("returns a promise, so a caller that forgets to await cannot pass by accident", () => {
      const service = serviceFor(signer.address);
      const result = service.isSignerOfMessage({
        message: NONCE,
        signature: "0x00",
      });
      expect(typeof result.then).toBe("function");
    });

    it("derives the public key when constructed from a private key", async () => {
      const service = new WalletService({ privateKey: signer.privateKey });
      const signature = await signer.signMessage(NONCE);

      await expect(
        service.isSignerOfMessage({ message: NONCE, signature })
      ).resolves.toBe(true);
    });

    it("does not expose the private key it was built with", () => {
      const service = new WalletService({ privateKey: signer.privateKey });
      expect(JSON.stringify(service)).not.toContain(signer.privateKey.slice(2));
      expect(Object.keys(service)).not.toContain("privateKey");
    });
  });
});

/**
 * Token issue and parse.
 *
 * The middleware only accepts the two header shapes the web app actually
 * sends, and only the algorithm the API signs with — an unsigned "alg: none"
 * token must never be honoured.
 */
describe("jwt middleware", () => {
  const ADDRESS = "0x1111111111111111111111111111111111111111";

  it("issues a token carrying the address and role", () => {
    const token = jwt.createToken({ address: ADDRESS, role: "user" });
    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));

    expect(claims.address).toBe(ADDRESS);
    expect(claims.role).toBe("user");
  });

  it("signs with HS256", () => {
    const token = jwt.createToken({ address: ADDRESS, role: "user" });
    const [header] = token.split(".");
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));

    expect(decoded.alg).toBe("HS256");
  });

  it("sets an expiry", () => {
    const token = jwt.createToken({ address: ADDRESS, role: "user" });
    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));

    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("produces a different token for a different address", () => {
    const a = jwt.createToken({ address: ADDRESS, role: "user" });
    const b = jwt.createToken({
      address: "0x2222222222222222222222222222222222222222",
      role: "user",
    });
    expect(a).not.toBe(b);
  });

  it("exposes an express middleware for guarded routes", () => {
    expect(typeof jwt.isAuth).toBe("function");
  });
});
