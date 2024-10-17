const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

/**
 * Presale lifecycle.
 *
 * Chain time is advanced with the network helpers rather than slept through:
 * `block.timestamp` is what the contract compares against, and it does not
 * track the wall clock once other tests have mined blocks.
 */
describe("LaunchpadV1", () => {
  const DAY = 24 * 60 * 60;
  const SOFT_CAP = ethers.utils.parseEther("2");
  const HARD_CAP = ethers.utils.parseEther("10");
  const MIN_BUY = ethers.utils.parseEther("0.1");
  const MAX_BUY = ethers.utils.parseEther("5");
  const PRESALE_RATE = 1000;

  let owner;
  let alice;
  let bob;

  /** Deploy a token and a presale over it, funded with the sale allocation. */
  const deploySale = async ({ startsIn = 0, runsFor = DAY } = {}) => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy(
      "Sale Token",
      "SALE",
      18,
      ethers.utils.parseEther("1000000")
    );
    await token.deployed();

    const startTime = (await time.latest()) + startsIn;
    const endTime = startTime + runsFor;

    const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");
    const sale = await LaunchpadV1.deploy(
      token.address,
      [SOFT_CAP, HARD_CAP],
      [startTime, endTime],
      PRESALE_RATE,
      [MIN_BUY, MAX_BUY],
      "https://example.invalid/meta"
    );
    await sale.deployed();

    await token.transfer(sale.address, ethers.utils.parseEther("100000"));

    return { token, sale, startTime, endTime };
  };

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
  });

  describe("construction", () => {
    it("records the caps", async () => {
      const { sale } = await deploySale();
      expect(await sale.softCap()).to.equal(SOFT_CAP);
      expect(await sale.hardCap()).to.equal(HARD_CAP);
    });

    it("opens in the OPENING state", async () => {
      const { sale } = await deploySale();
      expect(await sale.state()).to.equal(0);
    });

    it("rejects a zero token address", async () => {
      const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");
      const startTime = (await time.latest()) + 60;

      await expect(
        LaunchpadV1.deploy(
          ethers.constants.AddressZero,
          [SOFT_CAP, HARD_CAP],
          [startTime, startTime + DAY],
          PRESALE_RATE,
          [MIN_BUY, MAX_BUY],
          ""
        )
      ).to.be.revertedWith("LaunchpadV1: zero token");
    });

    it("rejects a hard cap below the soft cap", async () => {
      const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("T", "T", 18, 1000);
      const startTime = (await time.latest()) + 60;

      await expect(
        LaunchpadV1.deploy(
          token.address,
          [HARD_CAP, SOFT_CAP],
          [startTime, startTime + DAY],
          PRESALE_RATE,
          [MIN_BUY, MAX_BUY],
          ""
        )
      ).to.be.revertedWith("LaunchpadV1: bad caps");
    });

    it("rejects a window that ends before it starts", async () => {
      const LaunchpadV1 = await ethers.getContractFactory("LaunchpadV1");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("T", "T", 18, 1000);
      const startTime = (await time.latest()) + 600;

      await expect(
        LaunchpadV1.deploy(
          token.address,
          [SOFT_CAP, HARD_CAP],
          [startTime, startTime - 60],
          PRESALE_RATE,
          [MIN_BUY, MAX_BUY],
          ""
        )
      ).to.be.revertedWith("LaunchpadV1: bad window");
    });
  });

  describe("investing", () => {
    it("accepts a contribution inside the window", async () => {
      const { sale } = await deploySale();

      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });

      expect(await sale.depositedAmount(alice.address)).to.equal(
        ethers.utils.parseEther("1")
      );
    });

    it("credits the token allocation at the presale rate", async () => {
      const { sale } = await deploySale();

      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });

      expect(await sale.earnedAmount(alice.address)).to.equal(
        ethers.utils.parseEther("1000")
      );
    });

    it("counts each contributor once", async () => {
      const { sale } = await deploySale();

      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });

      expect(await sale.contributorCount()).to.equal(1);
    });

    it("rejects a contribution below the minimum", async () => {
      const { sale } = await deploySale();

      await expect(
        sale.connect(alice).invest({ value: ethers.utils.parseEther("0.01") })
      ).to.be.reverted;
    });

    it("rejects a contribution above the per-participant maximum", async () => {
      const { sale } = await deploySale();

      await expect(
        sale.connect(alice).invest({ value: ethers.utils.parseEther("6") })
      ).to.be.reverted;
    });

    it("rejects a contribution that would breach the hard cap", async () => {
      const { sale } = await deploySale();

      await sale.connect(alice).invest({ value: ethers.utils.parseEther("5") });
      await sale.connect(bob).invest({ value: ethers.utils.parseEther("5") });

      await expect(
        sale.connect(owner).invest({ value: ethers.utils.parseEther("1") })
      ).to.be.reverted;
    });

    it("rejects a contribution before the sale opens", async () => {
      const { sale } = await deploySale({ startsIn: DAY });

      await expect(
        sale.connect(alice).invest({ value: ethers.utils.parseEther("1") })
      ).to.be.reverted;
    });

    it("rejects a contribution after the sale closes", async () => {
      const { sale, endTime } = await deploySale();
      await time.increaseTo(endTime + 1);

      await expect(
        sale.connect(alice).invest({ value: ethers.utils.parseEther("1") })
      ).to.be.reverted;
    });
  });

  describe("closing", () => {
    it("pays the raise out to the owner", async () => {
      const { sale, endTime } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });
      await time.increaseTo(endTime + 1);

      await expect(sale.connect(owner).closeSale()).to.changeEtherBalance(
        owner,
        ethers.utils.parseEther("3")
      );
    });

    it("refuses to close a sale that missed its soft cap", async () => {
      const { sale, endTime } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });
      await time.increaseTo(endTime + 1);

      await expect(sale.connect(owner).closeSale()).to.be.revertedWith(
        "LaunchpadV1: soft cap not reached"
      );
    });

    it("refuses to close while the sale is still running", async () => {
      const { sale } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });

      await expect(sale.connect(owner).closeSale()).to.be.revertedWith(
        "LaunchpadV1: still open"
      );
    });

    it("refuses to let anyone but the owner close it", async () => {
      const { sale, endTime } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });
      await time.increaseTo(endTime + 1);

      await expect(sale.connect(alice).closeSale()).to.be.reverted;
    });
  });

  describe("claiming and refunding", () => {
    it("hands the tokens over once the sale has settled", async () => {
      const { sale, token, endTime } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });
      await time.increaseTo(endTime + 1);
      await sale.connect(owner).closeSale();

      await sale.connect(alice).claim();

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.utils.parseEther("3000")
      );
    });

    it("cannot be claimed twice", async () => {
      const { sale, endTime } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });
      await time.increaseTo(endTime + 1);
      await sale.connect(owner).closeSale();
      await sale.connect(alice).claim();

      await expect(sale.connect(alice).claim()).to.be.reverted;
    });

    it("cannot be claimed before the sale settles", async () => {
      const { sale } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("3") });

      await expect(sale.connect(alice).claim()).to.be.reverted;
    });

    it("returns contributions after a cancellation", async () => {
      const { sale } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });
      await sale.connect(owner).cancelSale();

      await expect(sale.connect(alice).refund()).to.changeEtherBalance(
        alice,
        ethers.utils.parseEther("1")
      );
    });

    it("cannot be refunded twice", async () => {
      const { sale } = await deploySale();
      await sale.connect(alice).invest({ value: ethers.utils.parseEther("1") });
      await sale.connect(owner).cancelSale();
      await sale.connect(alice).refund();

      await expect(sale.connect(alice).refund()).to.be.reverted;
    });
  });
});
