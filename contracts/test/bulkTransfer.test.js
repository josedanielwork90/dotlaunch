const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Batch distribution.
 *
 * The contract's value is its all-or-nothing guarantee: the multisend screen
 * treats a batch as one unit of work, which is only safe if a failure
 * anywhere reverts the whole thing. Partial success would leave the operator
 * reconciling which of 300 recipients were paid.
 */
describe("BulkTransfer", () => {
  let bulk;
  let token;
  let sender;
  let a;
  let b;
  let c;

  const amount = (n) => ethers.utils.parseEther(String(n));

  beforeEach(async () => {
    [sender, a, b, c] = await ethers.getSigners();

    const BulkTransfer = await ethers.getContractFactory("BulkTransfer");
    bulk = await BulkTransfer.deploy();
    await bulk.deployed();

    const Token = await ethers.getContractFactory("ManagedStandardToken");
    token = await Token.deploy(
      "Airdrop Token",
      "AIR",
      18,
      amount(1000000),
      sender.address,
      [false, true, false, false]
    );
    await token.deployed();
  });

  const approve = (value) => token.connect(sender).approve(bulk.address, value);

  describe("distribution", () => {
    it("pays every recipient their own amount", async () => {
      const settings = [
        { receiver: a.address, amount: amount(10) },
        { receiver: b.address, amount: amount(25) },
        { receiver: c.address, amount: amount(5) },
      ];
      await approve(amount(40));

      await bulk.connect(sender).bulkTransfer(settings, token.address);

      expect(await token.balanceOf(a.address)).to.equal(amount(10));
      expect(await token.balanceOf(b.address)).to.equal(amount(25));
      expect(await token.balanceOf(c.address)).to.equal(amount(5));
    });

    it("takes the total from the sender and nothing more", async () => {
      const before = await token.balanceOf(sender.address);
      await approve(amount(40));

      await bulk.connect(sender).bulkTransfer(
        [
          { receiver: a.address, amount: amount(10) },
          { receiver: b.address, amount: amount(30) },
        ],
        token.address
      );

      expect(before.sub(await token.balanceOf(sender.address))).to.equal(
        amount(40)
      );
    });

    /** The contract must never end up holding the tokens it is routing. */
    it("holds no balance of its own afterwards", async () => {
      await approve(amount(15));
      await bulk
        .connect(sender)
        .bulkTransfer([{ receiver: a.address, amount: amount(15) }], token.address);

      expect(await token.balanceOf(bulk.address)).to.equal(0);
    });

    it("emits a summary of the batch", async () => {
      await approve(amount(40));

      await expect(
        bulk.connect(sender).bulkTransfer(
          [
            { receiver: a.address, amount: amount(10) },
            { receiver: b.address, amount: amount(30) },
          ],
          token.address
        )
      )
        .to.emit(bulk, "BulkTransferExecuted")
        .withArgs(sender.address, token.address, 2, amount(40));
    });

    it("pays the same address twice when it appears twice", async () => {
      await approve(amount(30));

      await bulk.connect(sender).bulkTransfer(
        [
          { receiver: a.address, amount: amount(10) },
          { receiver: a.address, amount: amount(20) },
        ],
        token.address
      );

      expect(await token.balanceOf(a.address)).to.equal(amount(30));
    });
  });

});
