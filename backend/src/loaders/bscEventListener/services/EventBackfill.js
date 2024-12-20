const loggerContainer = require("../../loggerContainer");
const config = require("../../../config");
const {
  getMultiEventsByName,
} = require("../helpers/transactionHistoryWorker");

const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

/**
 * Catch-up indexing.
 *
 * The cron listener walks forward from wherever it left off, which is right
 * for steady state and useless after a long outage: a thousand-block window
 * every thirty seconds takes hours to cross a week of chain. This walks the
 * gap in bounded chunks as fast as the node will answer, and stops when it
 * reaches the head.
 */

const CHUNK = config.eventListener.blockRange || 1000;

/**
 * Replay `eventList` from `fromBlock` to `toBlock` in chunks.
 *
 * @param {object} options
 * @param {Array} options.eventList  Contract/event pairs to query.
 * @param {number} options.fromBlock Inclusive first block.
 * @param {number} options.toBlock   Inclusive last block.
 * @param {(batch: object) => Promise<void>} options.onBatch
 * @returns {Promise<{chunks: number, events: number, lastBlock: number}>}
 */
const backfill = async ({ eventList, fromBlock, toBlock, onBatch }) => {
  if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock)) {
    throw new Error("backfill needs a numeric block range");
  }
  if (fromBlock > toBlock) {
    return { chunks: 0, events: 0, lastBlock: toBlock };
  }

  let cursor = fromBlock;
  let chunks = 0;
  let events = 0;

  while (cursor <= toBlock) {
    const end = Math.min(cursor + CHUNK - 1, toBlock);

    // eslint-disable-next-line no-await-in-loop
    const { results } = await getMultiEventsByName({
      eventList,
      startBlockNumber: cursor,
      endBlockNumber: end,
    });

    const flattened = results.flat();
    events += flattened.length;
    chunks += 1;

    if (flattened.length > 0 && typeof onBatch === "function") {
      // eslint-disable-next-line no-await-in-loop
      await onBatch({ from: cursor, to: end, logs: flattened });
    }

    logger.info(
      `Backfilled ${cursor}..${end} (${flattened.length} events, ${chunks} chunks)`
    );

    cursor = end + 1;
  }

  return { chunks, events, lastBlock: toBlock };
};

/** How far behind the head the listener currently is. */
const measureGap = (lastIndexedBlock, headBlock) =>
  Math.max(0, Number(headBlock) - Number(lastIndexedBlock));

/** Whether the gap is wide enough to be worth a dedicated backfill pass. */
const needsBackfill = (lastIndexedBlock, headBlock) =>
  measureGap(lastIndexedBlock, headBlock) > CHUNK * 3;

module.exports = { backfill, measureGap, needsBackfill, CHUNK };
