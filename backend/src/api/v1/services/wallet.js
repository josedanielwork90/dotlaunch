const ethers = require("ethers");

class WalletService {
  #privateKey;
  #publicKey;

  constructor({ privateKey, publicKey }) {
    if (privateKey) {
      this.#privateKey = privateKey;
      const wallet = new ethers.Wallet(privateKey);
      this.#publicKey = wallet.address;
    } else {
      this.#publicKey = publicKey;
    }
  }

  isSignerOfMessage = async ({ message, signature }) => {
    try {
      const signer = ethers.utils.verifyMessage(String(message), signature);
      return this.#publicKey.toLowerCase() === signer.toLowerCase();
    } catch (err) {
      return false;
    }
  };
}

module.exports = WalletService;
