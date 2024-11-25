const { expect } = require("chai");
const { ethers } = require("hardhat");

const amount = (n) => ethers.utils.parseEther(String(n));

/**
 * Token capability flags.
 *
 * The flags are immutable by design. Someone evaluating a presale needs to
 * know a deployer cannot switch minting on after the raise, so these tests
 * assert both that an enabled capability works and that a disabled one stays
 * disabled for the owner.
 */
describe("ManagedStandardToken", () => {
  let owner;
  let holder;
  let other;

  const deploy = async (capabilities, decimals = 18) => {
    const Token = await ethers.getContractFactory("ManagedStandardToken");
    const token = await Token.deploy(
      "Demo",
      "DEMO",
      decimals,
      ethers.utils.parseUnits("1000000", decimals),
      owner.address,
      capabilities
    );
    await token.deployed();
    return token;
  };

  beforeEach(async () => {
    [owner, holder, other] = await ethers.getSigners();
  });

  describe("construction", () => {
    it("mints the whole supply to the owner", async () => {
      const token = await deploy([false, false, false, false]);

      expect(await token.totalSupply()).to.equal(amount(1000000));
      expect(await token.balanceOf(owner.address)).to.equal(amount(1000000));
    });

    it("honours a non-18 decimals value", async () => {
      const token = await deploy([false, false, false, false], 9);

      expect(await token.decimals()).to.equal(9);
      expect(await token.totalSupply()).to.equal(
        ethers.utils.parseUnits("1000000", 9)
      );
    });

    it("rejects a zero owner", async () => {
      const Token = await ethers.getContractFactory("ManagedStandardToken");
      await expect(
        Token.deploy("Demo", "DEMO", 18, amount(1), ethers.constants.AddressZero, [
          false,
          false,
          false,
          false,
        ])
      ).to.be.revertedWith("Token: zero owner");
    });

    it("rejects an empty name or symbol", async () => {
      const Token = await ethers.getContractFactory("ManagedStandardToken");

      await expect(
        Token.deploy("", "DEMO", 18, amount(1), owner.address, [
          false,
          false,
          false,
          false,
        ])
      ).to.be.revertedWith("Token: empty name");

      await expect(
        Token.deploy("Demo", "", 18, amount(1), owner.address, [
          false,
          false,
          false,
          false,
        ])
      ).to.be.revertedWith("Token: empty symbol");
    });

    it("rejects more than 18 decimals", async () => {
      const Token = await ethers.getContractFactory("ManagedStandardToken");
      await expect(
        Token.deploy("Demo", "DEMO", 19, amount(1), owner.address, [
          false,
          false,
          false,
          false,
        ])
      ).to.be.revertedWith("Token: decimals too large");
    });
  });

  describe("minting", () => {
    it("mints when enabled", async () => {
      const token = await deploy([true, false, false, false]);

      await token.mint(holder.address, amount(500));
      expect(await token.balanceOf(holder.address)).to.equal(amount(500));
    });

    /** The rug-pull vector: an owner enabling supply inflation after launch. */
    it("cannot mint when disabled, even as owner", async () => {
      const token = await deploy([false, false, false, false]);

      await expect(token.mint(holder.address, amount(1)))
        .to.be.revertedWithCustomError(token, "CapabilityDisabled")
        .withArgs("mint");
    });

    it("does not let a non-owner mint", async () => {
      const token = await deploy([true, false, false, false]);

      await expect(
        token.connect(holder).mint(holder.address, amount(1))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("burning", () => {
    it("burns when enabled and reduces total supply", async () => {
      const token = await deploy([false, true, false, false]);
      const before = await token.totalSupply();

      await token.burn(amount(100));

      expect(await token.totalSupply()).to.equal(before.sub(amount(100)));
    });

    it("cannot burn when disabled", async () => {
      const token = await deploy([false, false, false, false]);

      await expect(token.burn(amount(1)))
        .to.be.revertedWithCustomError(token, "CapabilityDisabled")
        .withArgs("burn");
    });
  });

  describe("pausing", () => {
    it("halts transfers while paused and resumes after", async () => {
      const token = await deploy([false, false, true, false]);
      await token.transfer(holder.address, amount(10));

      await token.pause();
      await expect(
        token.connect(holder).transfer(other.address, amount(1))
      ).to.be.revertedWith("Pausable: paused");

      await token.unpause();
      await token.connect(holder).transfer(other.address, amount(1));
      expect(await token.balanceOf(other.address)).to.equal(amount(1));
    });

    it("cannot pause when disabled", async () => {
      const token = await deploy([false, false, false, false]);
      await expect(token.pause())
        .to.be.revertedWithCustomError(token, "CapabilityDisabled")
        .withArgs("pause");
    });
  });

});
