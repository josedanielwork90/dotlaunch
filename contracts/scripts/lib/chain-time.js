/**
 * Chain clock control for seeding.
 *
 * The demo dataset needs sales that already ran, sales open right now, and
 * sales that have not started. Rather than fabricate those states in the
 * database, the seeder walks the chain's clock forward through each window
 * and performs the real transactions, so contract state and UI agree.
 *
 * These helpers wrap the anvil/hardhat RPC methods that make that possible.
 * Every one of them is a no-op on a real network, and the seeder refuses to
 * run against anything but a local chain (see `assertLocalChain`).
 */

const { network, ethers } = require("hardhat");

/** Chain ids that are safe to time-travel and seed. */
const LOCAL_CHAIN_IDS = new Set([31337, 1337]);

/**
 * Abort unless we are pointed at a local development chain.
 *
 * The seeder mints tokens, moves the clock and cancels sales. Running it
 * against a live network would be destructive, so this is a hard gate rather
 * than a warning.
 */
const assertLocalChain = async () => {
  const { chainId } = await ethers.provider.getNetwork();
  if (!LOCAL_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `Refusing to seed chain ${chainId}. The seeder is only for local ` +
        `development chains (${[...LOCAL_CHAIN_IDS].join(", ")}).`
    );
  }
  return chainId;
};

/** Timestamp of the latest block. */
const chainNow = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

/**
 * Mine one block, optionally at an exact timestamp.
 *
 * @param {number} [timestamp] Unix seconds. Must be >= the current head;
 *   EVM time cannot move backwards.
 */
const mine = async (timestamp) => {
  if (timestamp === undefined) {
    await network.provider.send("evm_mine");
    return;
  }
  await network.provider.send("evm_mine", [timestamp]);
};

/**
 * Move the chain clock to `timestamp`.
 *
 * Returns false without doing anything when the chain is already past that
 * point, so callers can seed a timeline without tracking where they are.
 */
const travelTo = async (timestamp) => {
  const current = await chainNow();
  if (timestamp <= current) return false;

  await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await mine();
  return true;
};

/** Advance the clock by a number of seconds. */
const travelBy = async (seconds) => {
  if (seconds <= 0) return false;
  await network.provider.send("evm_increaseTime", [seconds]);
  await mine();
  return true;
};

/** Human-readable ISO string for a chain timestamp, for log output. */
const iso = (timestamp) => new Date(timestamp * 1000).toISOString();

module.exports = {
  LOCAL_CHAIN_IDS,
  assertLocalChain,
  chainNow,
  mine,
  travelTo,
  travelBy,
  iso,
};
