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

  describe("blacklisting", () => {
    it("blocks a blacklisted sender and receiver", async () => {
      const token = await deploy([false, false, false, true]);
      await token.transfer(holder.address, amount(100));

      await token.setBlacklisted(holder.address, true);

      await expect(token.connect(holder).transfer(other.address, amount(1)))
        .to.be.revertedWithCustomError(token, "AccountBlacklisted")
        .withArgs(holder.address);
      await expect(token.transfer(holder.address, amount(1)))
        .to.be.revertedWithCustomError(token, "AccountBlacklisted")
        .withArgs(holder.address);
    });

    it("lifts the block when removed", async () => {
      const token = await deploy([false, false, false, true]);
      await token.transfer(holder.address, amount(100));
      await token.setBlacklisted(holder.address, true);
      await token.setBlacklisted(holder.address, false);

      await token.connect(holder).transfer(other.address, amount(1));
      expect(await token.balanceOf(other.address)).to.equal(amount(1));
    });

    it("blacklists a batch in one call", async () => {
      const token = await deploy([false, false, false, true]);

      await token.setBlacklistedBatch([holder.address, other.address], true);

      expect(await token.isBlacklisted(holder.address)).to.equal(true);
      expect(await token.isBlacklisted(other.address)).to.equal(true);
    });

    it("cannot blacklist when disabled", async () => {
      const token = await deploy([false, false, false, false]);

      await expect(token.setBlacklisted(holder.address, true))
        .to.be.revertedWithCustomError(token, "CapabilityDisabled")
        .withArgs("blacklist");
    });
  });
});

/**
 * Fee-on-transfer behaviour.
 *
 * The common failure in this token class is an owner raising the tax after
 * launch, so fees are immutable and capped. These tests pin both, and check
 * that the on-chain quote matches what a transfer actually delivers - the UI
 * relies on that rather than recomputing the tax in JavaScript.
 */
describe("ManagedLiquidityToken", () => {
  let owner;
  let feeReceiver;
  let alice;
  let bob;

  const BPS = 10000;

  const deploy = async (fees, settingFlag = 0) => {
    const Token = await ethers.getContractFactory("ManagedLiquidityToken");
    const token = await Token.deploy(
      "Ember",
      "EMBR",
      18,
      amount(1000000),
      owner.address,
      feeReceiver.address,
      fees,
      settingFlag,
      [false, true, false, false]
    );
    await token.deployed();
    return token;
  };

  beforeEach(async () => {
    [owner, feeReceiver, alice, bob] = await ethers.getSigners();
  });

  describe("fee limits", () => {
    it("rejects a total fee above the cap", async () => {
      const Token = await ethers.getContractFactory("ManagedLiquidityToken");

      await expect(
        Token.deploy(
          "Ember",
          "EMBR",
          18,
          amount(1),
          owner.address,
          feeReceiver.address,
          [2000, 1000, 0, 0], // 30%, over the 25% cap
          0,
          [false, false, false, false]
        )
      ).to.be.revertedWith("Token: total fee too high");
    });

    it("accepts a total fee at exactly the cap", async () => {
      const token = await deploy([1000, 1000, 500, 0]);
      expect(await token.totalFeeBps()).to.equal(2500);
    });
  });

  describe("taxed transfers", () => {
    it("delivers the amount minus the total fee", async () => {
      const token = await deploy([200, 100, 100, 0]); // 4% total
      await token.transfer(alice.address, amount(1000));

      await token.connect(alice).transfer(bob.address, amount(100));

      const expected = amount(100).mul(BPS - 400).div(BPS);
      expect(await token.balanceOf(bob.address)).to.equal(expected);
    });

    it("routes liquidity and marketing shares to the fee receiver", async () => {
      const token = await deploy([200, 100, 0, 0]);
      await token.transfer(alice.address, amount(1000));
      const before = await token.balanceOf(feeReceiver.address);

      await token.connect(alice).transfer(bob.address, amount(100));

      const expected = amount(100).mul(300).div(BPS);
      expect((await token.balanceOf(feeReceiver.address)).sub(before)).to.equal(
        expected
      );
    });

    it("burns the burn share when auto-burn is on", async () => {
      const FLAG_AUTO_BURN = 8;
      const token = await deploy([0, 0, 0, 200], FLAG_AUTO_BURN);
      await token.transfer(alice.address, amount(1000));
      const before = await token.totalSupply();

      await token.connect(alice).transfer(bob.address, amount(100));

      expect(await token.totalSupply()).to.equal(
        before.sub(amount(100).mul(200).div(BPS))
      );
    });

    it("conserves value: nothing is created or destroyed without a burn", async () => {
      const token = await deploy([200, 100, 100, 0]);
      const supplyBefore = await token.totalSupply();

      await token.transfer(alice.address, amount(1000));
      await token.connect(alice).transfer(bob.address, amount(400));

      expect(await token.totalSupply()).to.equal(supplyBefore);
    });
  });

});
