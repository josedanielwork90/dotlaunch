const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

/**
 * Linear vesting with a cliff.
 *
 * The properties that matter are the ones a beneficiary would go to court
 * over: nothing before the cliff, a straight line after it, never more than
 * the allocation in total, and a revoke that cannot claw back what has
 * already vested.
 */
describe("Vesting", () => {
  const DAY = 24 * 60 * 60;
  const MONTH = 30 * DAY;
  const TOTAL = ethers.utils.parseEther("12000");

  let vesting;
  let token;
  let owner;
  let beneficiary;
  let stranger;

  const deployFixture = async () => {
    const Vesting = await ethers.getContractFactory("Vesting");
    const contract = await Vesting.deploy();
    await contract.deployed();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await MockERC20.deploy(
      "Vested",
      "VST",
      18,
      ethers.utils.parseEther("1000000")
    );
    await erc20.deployed();

    return { contract, erc20 };
  };

  /** Create a schedule starting now, with a one-month cliff over a year. */
  const createSchedule = async ({
    cliffSeconds = MONTH,
    duration = 12 * MONTH,
    revocable = true,
    startsIn = 0,
  } = {}) => {
    await token.connect(owner).approve(vesting.address, TOTAL);
    const start = (await time.latest()) + startsIn;

    await vesting
      .connect(owner)
      .create(
        token.address,
        beneficiary.address,
        TOTAL,
        start,
        cliffSeconds,
        duration,
        revocable
      );

    return { id: (await vesting.scheduleCount()).sub(1), start, duration };
  };

  beforeEach(async () => {
    [owner, beneficiary, stranger] = await ethers.getSigners();
    const fixture = await deployFixture();
    vesting = fixture.contract;
    token = fixture.erc20;
  });

  describe("creation", () => {
    it("pulls the whole allocation up front", async () => {
      await createSchedule();
      expect(await token.balanceOf(vesting.address)).to.equal(TOTAL);
    });

    it("records the schedule against its beneficiary", async () => {
      const { id } = await createSchedule();
      const ids = await vesting.schedulesFor(beneficiary.address);

      expect(ids.map((value) => value.toString())).to.include(id.toString());
    });

    it("rejects a zero allocation", async () => {
      const start = await time.latest();

      await expect(
        vesting.create(token.address, beneficiary.address, 0, start, 0, MONTH, false)
      ).to.be.revertedWith("Vesting: zero amount");
    });

    it("rejects a cliff that outlasts the schedule", async () => {
      const start = await time.latest();

      await expect(
        vesting.create(
          token.address,
          beneficiary.address,
          TOTAL,
          start,
          2 * MONTH,
          MONTH,
          false
        )
      ).to.be.revertedWith("Vesting: cliff after end");
    });
  });

  describe("vesting curve", () => {
    it("vests nothing before the cliff", async () => {
      const { id } = await createSchedule();
      await time.increase(MONTH / 2);

      expect(await vesting.vestedAmount(id)).to.equal(0);
    });

    it("vests the elapsed fraction once past the cliff", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);

      const vested = await vesting.vestedAmount(id);
      expect(vested).to.be.closeTo(TOTAL.div(2), ethers.utils.parseEther("1"));
    });

    it("vests the full allocation at the end and no more", async () => {
      const { id } = await createSchedule();
      await time.increase(24 * MONTH);

      expect(await vesting.vestedAmount(id)).to.equal(TOTAL);
    });
  });

  describe("releasing", () => {
    it("pays the beneficiary what has vested", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);

      await vesting.connect(beneficiary).release(id);

      expect(await token.balanceOf(beneficiary.address)).to.be.gt(0);
    });

    it("only ever pays the newly vested portion", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);
      await vesting.connect(beneficiary).release(id);

      const afterFirst = await token.balanceOf(beneficiary.address);
      await vesting.connect(beneficiary).release(id);
      const afterSecond = await token.balanceOf(beneficiary.address);

      // A second claim one block later is worth a few seconds of vesting,
      // not another tranche.
      expect(afterSecond.sub(afterFirst)).to.be.lt(
        ethers.utils.parseEther("1")
      );
    });

    it("refuses a claim once the whole allocation has been paid", async () => {
      const { id } = await createSchedule();
      await time.increase(24 * MONTH);
      await vesting.connect(beneficiary).release(id);

      await expect(vesting.connect(beneficiary).release(id)).to.be.reverted;
    });

    it("refuses anyone but the beneficiary", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);

      await expect(vesting.connect(stranger).release(id)).to.be.reverted;
    });

    it("refuses before the cliff", async () => {
      const { id } = await createSchedule();

      await expect(vesting.connect(beneficiary).release(id)).to.be.reverted;
    });

    it("pays out exactly the allocation over the whole schedule", async () => {
      const { id } = await createSchedule();
      await time.increase(24 * MONTH);
      await vesting.connect(beneficiary).release(id);

      expect(await token.balanceOf(beneficiary.address)).to.equal(TOTAL);
      expect(await token.balanceOf(vesting.address)).to.equal(0);
    });
  });

  describe("revoking", () => {
    it("returns only the unvested remainder to the grantor", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);

      const before = await token.balanceOf(owner.address);
      await vesting.connect(owner).revoke(id);
      const refunded = (await token.balanceOf(owner.address)).sub(before);

      expect(refunded).to.be.closeTo(TOTAL.div(2), ethers.utils.parseEther("1"));
    });

    it("leaves what had already vested claimable", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);
      await vesting.connect(owner).revoke(id);

      await vesting.connect(beneficiary).release(id);

      expect(await token.balanceOf(beneficiary.address)).to.be.gt(0);
    });

    it("refuses to revoke a schedule that was not revocable", async () => {
      const { id } = await createSchedule({ revocable: false });

      await expect(vesting.connect(owner).revoke(id)).to.be.reverted;
    });

    it("refuses to revoke twice", async () => {
      const { id } = await createSchedule();
      await time.increase(6 * MONTH);
      await vesting.connect(owner).revoke(id);

      await expect(vesting.connect(owner).revoke(id)).to.be.reverted;
    });

    it("refuses anyone but the contract owner", async () => {
      const { id } = await createSchedule();

      await expect(vesting.connect(stranger).revoke(id)).to.be.reverted;
    });
  });
});
