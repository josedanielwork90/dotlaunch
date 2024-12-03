const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

/**
 * Token locks.
 *
 * SenseiLock custodies team allocations and liquidity for the whole platform,
 * so the properties that matter are custody properties: only the recorded
 * owner can withdraw, nothing can be withdrawn early, a lock can be topped up
 * or extended but never shortened or reduced, and the cumulative totals the
 * UI reads stay consistent with the balance actually held.
 *
 * Chain time is advanced with the network helpers rather than slept through,
 * so these run in milliseconds and do not depend on the chain clock happening
 * to match the wall clock.
 */
describe("SenseiLock", () => {
  const DAY = 24 * 60 * 60;
  const AMOUNT = ethers.utils.parseEther("1000");

  let lock;
  let token;
  let owner;
  let alice;
  let bob;

  /** Deploy a lock contract and an ERC20 held by `owner`. */
  const deployFixture = async () => {
    const SenseiLock = await ethers.getContractFactory("SenseiLock");
    const locker = await SenseiLock.deploy();
    await locker.deployed();

    const Token = await ethers.getContractFactory("Token");
    const erc20 = await Token.deploy();
    await erc20.deployed();

    return { locker, erc20 };
  };

  /** Lock `amount` of `token` for `holder`, unlocking `afterSeconds` from now. */
  const lockFor = async ({
    holder = alice,
    amount = AMOUNT,
    afterSeconds = 30 * DAY,
    from = owner,
  } = {}) => {
    await token.connect(from).approve(lock.address, amount);
    const unlockDate = (await time.latest()) + afterSeconds;

    const tx = await lock
      .connect(from)
      .lock(holder.address, token.address, false, amount, unlockDate);
    await tx.wait();

    return { unlockDate, id: (await lock.getTotalLockCount()).sub(1) };
  };

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    const fixture = await deployFixture();
    lock = fixture.locker;
    token = fixture.erc20;
  });

  describe("locking", () => {
    it("starts with no locks", async () => {
      expect(await lock.getTotalLockCount()).to.equal(0);
      expect(await lock.allLocks()).to.have.lengthOf(0);
    });

    it("takes custody of the tokens", async () => {
      await lockFor();

      expect(await token.balanceOf(lock.address)).to.equal(AMOUNT);
    });

    it("records the lock against the nominated owner, not the payer", async () => {
      const { id } = await lockFor({ holder: alice, from: owner });
      const stored = await lock.getLock(id);

      expect(stored.owner).to.equal(alice.address);
      expect(stored.amount).to.equal(AMOUNT);
      expect(stored.token).to.equal(token.address);
    });

    it("stamps the lock with the block it was created in", async () => {
      const { id } = await lockFor();
      const stored = await lock.getLock(id);

      expect(stored.lockDate).to.equal(await time.latest());
    });

    it("emits LockAdded", async () => {
      await token.connect(owner).approve(lock.address, AMOUNT);
      const unlockDate = (await time.latest()) + 30 * DAY;

      await expect(
        lock.lock(alice.address, token.address, false, AMOUNT, unlockDate)
      )
        .to.emit(lock, "LockAdded")
        .withArgs(0, token.address, alice.address, AMOUNT, unlockDate);
    });

    it("numbers locks sequentially from zero", async () => {
      const first = await lockFor();
      const second = await lockFor({ holder: bob });

      expect(first.id).to.equal(0);
      expect(second.id).to.equal(1);
      expect(await lock.getTotalLockCount()).to.equal(2);
    });

    it("refuses an unlock date in the past", async () => {
      await token.connect(owner).approve(lock.address, AMOUNT);
      const past = (await time.latest()) - 1;

      await expect(
        lock.lock(alice.address, token.address, false, AMOUNT, past)
      ).to.be.revertedWith("Unlock date should be after current time");
    });

    it("refuses a zero amount", async () => {
      const unlockDate = (await time.latest()) + DAY;

      await expect(
        lock.lock(alice.address, token.address, false, 0, unlockDate)
      ).to.be.revertedWith("Amount should be greater than 0");
    });

    it("refuses to lock without an allowance", async () => {
      const unlockDate = (await time.latest()) + DAY;

      await expect(
        lock.lock(alice.address, token.address, false, AMOUNT, unlockDate)
      ).to.be.reverted;
    });

    /**
     * A plain ERC20 has no `factory()`, so claiming it is an LP token has to
     * fail loudly - the LP branch records a pair symbol and would otherwise
     * store nonsense against the token.
     */
    it("refuses a plain ERC20 presented as an LP token", async () => {
      await token.connect(owner).approve(lock.address, AMOUNT);
      const unlockDate = (await time.latest()) + DAY;

      await expect(
        lock.lock(alice.address, token.address, true, AMOUNT, unlockDate)
      ).to.be.revertedWith("This token is not a LP token");
    });
  });

  describe("cumulative reporting", () => {
    it("records the token's metadata on first lock", async () => {
      await lockFor();
      const info = await lock.cumulativeLockInfo(token.address);

      expect(info.token).to.equal(token.address);
      expect(info.name).to.equal(await token.name());
      expect(info.symbol).to.equal(await token.symbol());
      expect(info.decimals).to.equal(await token.decimals());
    });

    it("leaves the factory empty for a non-LP lock", async () => {
      await lockFor();
      const info = await lock.cumulativeLockInfo(token.address);

      expect(info.factory).to.equal(ethers.constants.AddressZero);
    });

    it("sums every lock on the same token", async () => {
      await lockFor({ amount: ethers.utils.parseEther("100") });
      await lockFor({ holder: bob, amount: ethers.utils.parseEther("250") });

      const info = await lock.cumulativeLockInfo(token.address);
      expect(info.amount).to.equal(ethers.utils.parseEther("350"));
    });

    it("counts the token once however many locks it has", async () => {
      await lockFor();
      await lockFor({ holder: bob });

      expect(await lock.allNormalTokenLockedCount()).to.equal(1);
    });

    it("tracks the total held against the contract balance", async () => {
      await lockFor({ amount: ethers.utils.parseEther("10") });
      await lockFor({ amount: ethers.utils.parseEther("15") });

      const info = await lock.cumulativeLockInfo(token.address);
      expect(info.amount).to.equal(await token.balanceOf(lock.address));
    });

    it("lists locks per user", async () => {
      await lockFor({ holder: alice });
      await lockFor({ holder: alice });
      await lockFor({ holder: bob });

      expect(await lock.normalLockCountForUser(alice.address)).to.equal(2);
      expect(await lock.normalLockCountForUser(bob.address)).to.equal(1);
      expect(await lock.totalLockCountForUser(alice.address)).to.equal(2);
    });

    it("lists locks per token", async () => {
      await lockFor();
      await lockFor({ holder: bob });

      expect(await lock.totalLockCountForToken(token.address)).to.equal(2);
    });

    it("reports a slice of the cumulative table", async () => {
      await lockFor();
      const slice = await lock.getCumulativeNormalTokenLockInfo(0, 1);

      expect(slice).to.have.lengthOf(1);
      expect(slice[0].token).to.equal(token.address);
    });
  });

});
