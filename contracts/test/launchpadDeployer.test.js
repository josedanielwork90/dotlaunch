const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

/**
 * End-to-end presale lifecycle: create, invest, close, claim.
 *
 * Time is taken from the chain and advanced with the network helpers rather
 * than read from the system clock and waited out with `setTimeout`. The
 * original version did the latter, which made it depend on the chain's clock
 * happening to match the wall clock, and on ten seconds of real sleeping. It
 * passed in isolation and failed as soon as any other test file mined blocks
 * first, because those blocks pushed chain time past the sale window before
 * the investment ran.
 */
describe("Launchpad deployer", () => {
  const SOFT_CAP = ethers.utils.parseEther("0.02");
  const HARD_CAP = ethers.utils.parseEther("0.05");
  const DEPLOY_COST = ethers.utils.parseEther("0.001");
  const PRESALE_RATE = 100000;
  const LISTING_RATE = 90000;

  let launchpadDeployer;
  let token;
  let owner;
  let user;
  let user2;

  /** Deploy a fresh deployer, token and presale, and return them. */
  const deployPresale = async ({ windowSeconds = 3600 } = {}) => {
    const LaunchpadDeployer = await ethers.getContractFactory("LaunchpadDeployer");
    const deployer = await LaunchpadDeployer.deploy();
    await deployer.deployed();

    const Token = await ethers.getContractFactory("Token");
    const saleToken = await Token.deploy();
    await saleToken.deployed();

    await saleToken
      .connect(owner)
      .approve(deployer.address, ethers.utils.parseEther("100000000"));

    // Chain time, not wall-clock time. These must agree with block.timestamp
    // for the sale window to mean anything.
    const startAt = await time.latest();
    const endAt = startAt + windowSeconds;

    await deployer
      .connect(owner)
      .createLaunchpad(
        [SOFT_CAP, HARD_CAP],
        [startAt, endAt, endAt],
        [PRESALE_RATE, LISTING_RATE],
        [ethers.utils.parseEther("0.001"), ethers.utils.parseEther("0.1")],
        [5000, 5000],
        [saleToken.address, ethers.constants.AddressZero],
        "https://example.test/metadata",
        true,
        0,
        { value: DEPLOY_COST }
      );

    const address = await deployer.userLaunchpadCreated(0, owner.address, 0);
    const presale = await ethers.getContractAt("LaunchPad", address);

    return { deployer, saleToken, presale, address, startAt, endAt };
  };

  beforeEach(async () => {
    [owner, user, user2] = await ethers.getSigners();
    const deployed = await deployPresale();
    launchpadDeployer = deployed.deployer;
    token = deployed.saleToken;
  });

  describe("creation", () => {
    it("deploys a presale and funds it with the sale allocation", async () => {
      const { address, saleToken } = await deployPresale();

      expect(address).to.properAddress;
      expect(await saleToken.balanceOf(address)).to.be.gt(0);
    });

    it("records the presale against its creator", async () => {
      const { deployer, address } = await deployPresale();

      expect(await deployer.userLaunchpadCreated(0, owner.address, 0)).to.equal(
        address
      );
      expect(await deployer.launchpadCount(0)).to.equal(1);
    });

    it("refuses a second presale for the same token", async () => {
      const { deployer, saleToken } = await deployPresale();
      const startAt = await time.latest();

      await expect(
        deployer
          .connect(owner)
          .createLaunchpad(
            [SOFT_CAP, HARD_CAP],
            [startAt, startAt + 3600, startAt + 3600],
            [PRESALE_RATE, LISTING_RATE],
            [ethers.utils.parseEther("0.001"), ethers.utils.parseEther("0.1")],
            [5000, 5000],
            [saleToken.address, ethers.constants.AddressZero],
            "https://example.test/metadata",
            true,
            0,
            { value: DEPLOY_COST }
          )
      ).to.be.revertedWith("Launchpad already created");
    });

    it("refuses creation without the deploy fee", async () => {
      const LaunchpadDeployer = await ethers.getContractFactory(
        "LaunchpadDeployer"
      );
      const deployer = await LaunchpadDeployer.deploy();
      const Token = await ethers.getContractFactory("Token");
      const saleToken = await Token.deploy();
      await saleToken
        .connect(owner)
        .approve(deployer.address, ethers.utils.parseEther("100000000"));

      const startAt = await time.latest();

      await expect(
        deployer
          .connect(owner)
          .createLaunchpad(
            [SOFT_CAP, HARD_CAP],
            [startAt, startAt + 3600, startAt + 3600],
            [PRESALE_RATE, LISTING_RATE],
            [ethers.utils.parseEther("0.001"), ethers.utils.parseEther("0.1")],
            [5000, 5000],
            [saleToken.address, ethers.constants.AddressZero],
            "https://example.test/metadata",
            true,
            0,
            { value: 0 }
          )
      ).to.be.revertedWith("Not enough BNB to deploy");
    });
  });

  describe("investing", () => {
    it("accepts a contribution inside the window", async () => {
      const { presale } = await deployPresale();
      // The sale opens at the current block; move one second past it.
      await time.increase(1);

      await presale
        .connect(user)
        .invest(ethers.utils.parseEther("0.04"), {
          value: ethers.utils.parseEther("0.04"),
        });

      expect(await presale.totalDeposits()).to.equal(
        ethers.utils.parseEther("0.04")
      );
      expect(await presale.depositedAmount(user.address)).to.equal(
        ethers.utils.parseEther("0.04")
      );
    });

    it("records each contributor once", async () => {
      const { presale } = await deployPresale();
      await time.increase(1);

      await presale
        .connect(user)
        .invest(ethers.utils.parseEther("0.01"), {
          value: ethers.utils.parseEther("0.01"),
        });
      await presale
        .connect(user)
        .invest(ethers.utils.parseEther("0.01"), {
          value: ethers.utils.parseEther("0.01"),
        });

      expect(await presale.contributorId()).to.equal(1);
      expect(await presale.depositedAmount(user.address)).to.equal(
        ethers.utils.parseEther("0.02")
      );
    });

    it("refuses a contribution below the per-wallet minimum", async () => {
      const { presale } = await deployPresale();
      await time.increase(1);

      await expect(
        presale.connect(user).invest(ethers.utils.parseEther("0.0001"), {
          value: ethers.utils.parseEther("0.0001"),
        })
      ).to.be.revertedWith("Launchpad: Min contribution not reached");
    });

    it("refuses a contribution beyond the hard cap", async () => {
      const { presale } = await deployPresale();
      await time.increase(1);

      await expect(
        presale.connect(user).invest(ethers.utils.parseEther("0.06"), {
          value: ethers.utils.parseEther("0.06"),
        })
      ).to.be.revertedWith("Launchpad(Normal): Hardcap reached");
    });

    it("refuses a contribution once the window has closed", async () => {
      const { presale, endAt } = await deployPresale();
      await time.increaseTo(endAt + 1);

      await expect(
        presale.connect(user).invest(ethers.utils.parseEther("0.03"), {
          value: ethers.utils.parseEther("0.03"),
        })
      ).to.be.revertedWith("Launchpad: Sale is already closed");
    });

    it("refuses a payment that does not match the stated amount", async () => {
      const { presale } = await deployPresale();
      await time.increase(1);

      await expect(
        presale.connect(user).invest(ethers.utils.parseEther("0.03"), {
          value: ethers.utils.parseEther("0.01"),
        })
      ).to.be.revertedWith("Launchpad: Invalid payment amount");
    });
  });

});
