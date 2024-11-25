const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Token factory behaviour.
 *
 * The factory takes payment, so the money paths matter as much as the
 * deployment ones: a caller must not be able to underpay, and must not lose
 * the difference when they overpay.
 */
describe("ManageToken", () => {
  const FEES = {
    normal: ethers.utils.parseEther("0.001"),
    mint: ethers.utils.parseEther("0.0005"),
    burn: ethers.utils.parseEther("0.0005"),
    pause: ethers.utils.parseEther("0.0005"),
    blacklist: ethers.utils.parseEther("0.0005"),
    deflation: ethers.utils.parseEther("0.002"),
  };

  let factory;
  let owner;
  let creator;
  let stranger;

  beforeEach(async () => {
    [owner, creator, stranger] = await ethers.getSigners();

    const ManageToken = await ethers.getContractFactory("ManageToken");
    factory = await ManageToken.deploy();
    await factory.deployed();

    await factory.initFee(
      FEES.normal,
      FEES.mint,
      FEES.burn,
      FEES.pause,
      FEES.blacklist,
      FEES.deflation
    );
  });

  /** Deploy a standard token through the factory and return its address. */
  const createStandard = async (signer, capabilities, overrides = {}) => {
    const fee = await factory.quoteCreationFee(false, capabilities);
    const tx = await factory
      .connect(signer)
      .createStandard(
        signer.address,
        "Demo Token",
        "DEMO",
        18,
        ethers.utils.parseEther("1000000"),
        ...capabilities,
        { value: overrides.value !== undefined ? overrides.value : fee }
      );
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === "CreateStandardSuccess");
    return event.args[0];
  };

  describe("fee schedule", () => {
    it("reports the schedule that was set", async () => {
      const fee = await factory.fee();

      expect(fee.normal).to.equal(FEES.normal);
      expect(fee.deflation).to.equal(FEES.deflation);
      expect(fee.blacklist).to.equal(FEES.blacklist);
    });

    it("charges only the base fee for a token with no capabilities", async () => {
      expect(await factory.quoteCreationFee(false, [0, 0, 0, 0])).to.equal(
        FEES.normal
      );
    });

    it("adds a surcharge per enabled capability", async () => {
      expect(await factory.quoteCreationFee(false, [1, 0, 0, 0])).to.equal(
        FEES.normal.add(FEES.mint)
      );
      expect(await factory.quoteCreationFee(false, [1, 1, 1, 1])).to.equal(
        FEES.normal
          .add(FEES.mint)
          .add(FEES.burn)
          .add(FEES.pause)
          .add(FEES.blacklist)
      );
    });

    it("prices a liquidity token from the deflation base", async () => {
      expect(await factory.quoteCreationFee(true, [0, 0, 0, 0])).to.equal(
        FEES.deflation
      );
    });

    it("only lets the owner change fees", async () => {
      await expect(
        factory.connect(stranger).initFee(1, 1, 1, 1, 1, 1)
      ).to.be.revertedWith("ManageToken: caller is not the owner");
    });
  });

});
