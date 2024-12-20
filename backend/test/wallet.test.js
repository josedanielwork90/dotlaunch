const ethers = require("ethers");

const WalletService = require("../src/api/v1/services/wallet");

/**
 * Wallet ownership proof.
 *
 * DotLaunch has no passwords: proving control of an address is the login, so
 * this check is the whole authentication story.
 */
describe("WalletService", () => {
  const signer = ethers.Wallet.createRandom();
  const other = ethers.Wallet.createRandom();
  const NONCE = "dotlaunch-sign-in-8f21c0";

  it("accepts a signature from the claimed address", async () => {
    const signature = await signer.signMessage(NONCE);
    const service = new WalletService({ publicKey: signer.address });

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature })
    ).toBe(true);
  });

  it("matches the address case-insensitively", async () => {
    const signature = await signer.signMessage(NONCE);
    const service = new WalletService({
      publicKey: signer.address.toLowerCase(),
    });

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature })
    ).toBe(true);
  });

  it("rejects a signature from another wallet", async () => {
    const signature = await other.signMessage(NONCE);
    const service = new WalletService({ publicKey: signer.address });

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature })
    ).toBe(false);
  });

  it("rejects a signature over a different message", async () => {
    const signature = await signer.signMessage("a different nonce");
    const service = new WalletService({ publicKey: signer.address });

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature })
    ).toBe(false);
  });

  it("rejects malformed input rather than throwing", async () => {
    const service = new WalletService({ publicKey: signer.address });

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature: "nope" })
    ).toBe(false);
  });

  it("derives the address when built from a private key", async () => {
    const service = new WalletService({ privateKey: signer.privateKey });
    const signature = await signer.signMessage(NONCE);

    expect(
      await service.isSignerOfMessage({ message: NONCE, signature })
    ).toBe(true);
  });
});
