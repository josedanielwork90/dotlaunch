const ethers = require("ethers");

const {
  getNumberFromBN,
  setNumberToBN,
  getPriceNumberFromBN,
  getHexaNumberFromBN,
} = require("../../../backend/src/helpers/bn");

/**
 * BigNumber conversion helpers.
 *
 * Every value that arrives from a contract log is a BigNumber and every value
 * that leaves for MongoDB or JSON is not, so these four functions sit on the
 * boundary of the whole indexing path. They are also deliberately tolerant of
 * already-converted input: handlers call them on values that may have been
 * normalised upstream, and a helper that only worked on BigNumbers would make
 * that call site order-dependent.
 */
describe("bn helpers", () => {
  const BN = ethers.BigNumber.from;

  describe("getNumberFromBN", () => {
    it("converts a BigNumber to a JS number", () => {
      expect(getNumberFromBN(BN(1234))).toBe(1234);
    });

    it("passes a plain number through untouched", () => {
      expect(getNumberFromBN(42)).toBe(42);
    });

    it("passes a string through untouched", () => {
      expect(getNumberFromBN("not a number")).toBe("not a number");
    });

    it("converts zero", () => {
      expect(getNumberFromBN(BN(0))).toBe(0);
    });

    it("converts a chain timestamp without losing precision", () => {
      // Sale windows are stored as unix seconds and then multiplied by 1000;
      // losing precision here would move a sale by minutes.
      const timestamp = 1_749_988_800;
      expect(getNumberFromBN(BN(timestamp))).toBe(timestamp);
    });

    it("handles a negative BigNumber", () => {
      expect(getNumberFromBN(BN(-7))).toBe(-7);
    });
  });

  describe("setNumberToBN", () => {
    it("wraps a plain number", () => {
      const result = setNumberToBN(500);
      expect(ethers.BigNumber.isBigNumber(result)).toBe(true);
      expect(result.toString()).toBe("500");
    });

    it("wraps a decimal string", () => {
      expect(setNumberToBN("100000000000000000000").toString()).toBe(
        "100000000000000000000"
      );
    });

    it("returns an existing BigNumber unchanged", () => {
      const original = BN(9);
      expect(setNumberToBN(original)).toBe(original);
    });

    it("is idempotent", () => {
      const once = setNumberToBN(12);
      expect(setNumberToBN(once).toString()).toBe("12");
    });

    it("rejects a value that is not an integer", () => {
      expect(() => setNumberToBN(1.5)).toThrow();
    });
  });

  describe("getPriceNumberFromBN", () => {
    it("formats wei as a decimal ether string", () => {
      expect(getPriceNumberFromBN(ethers.utils.parseEther("1.5"))).toBe("1.5");
    });

    it("formats zero", () => {
      expect(getPriceNumberFromBN(BN(0))).toBe("0.0");
    });

    it("keeps full 18-decimal precision", () => {
      const oneWei = BN(1);
      expect(getPriceNumberFromBN(oneWei)).toBe("0.000000000000000001");
    });

    it("passes a non-BigNumber through untouched", () => {
      expect(getPriceNumberFromBN("1.5")).toBe("1.5");
    });

    it("survives a hardcap far beyond Number.MAX_SAFE_INTEGER", () => {
      const hardcap = ethers.utils.parseEther("21000000");
      expect(getPriceNumberFromBN(hardcap)).toBe("21000000.0");
    });
  });

  describe("getHexaNumberFromBN", () => {
    it("hex-encodes a BigNumber", () => {
      expect(getHexaNumberFromBN(BN(255))).toBe("0xff");
    });

    it("hex-encodes a plain number", () => {
      expect(getHexaNumberFromBN(16)).toBe("0x10");
    });

    it("encodes zero as 0x00", () => {
      expect(getHexaNumberFromBN(0)).toBe("0x00");
    });

    it("round-trips through BigNumber", () => {
      const hex = getHexaNumberFromBN(123456);
      expect(BN(hex).toNumber()).toBe(123456);
    });

    it("produces an even-length, 0x-prefixed string", () => {
      const hex = getHexaNumberFromBN(4095);
      expect(hex.startsWith("0x")).toBe(true);
      expect((hex.length - 2) % 2).toBe(0);
    });
  });
});
