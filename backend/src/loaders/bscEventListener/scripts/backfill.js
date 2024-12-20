/**
 * Replay chain history into the index.
 *
 *   node src/loaders/bscEventListener/scripts/backfill.js [fromBlock] [toBlock]
 *
 * Used after an outage, or when pointing the API at a chain it has never
 * indexed. Safe to run against a live listener: the handlers are idempotent,
 * so overlapping ranges cost time rather than correctness.
 */

const provider = require("../helpers/serviceProvider");
const mongoLoader = require("../../mongo");
const loggerContainer = require("../../loggerContainer");
const config = require("../../../config");
const { backfill, measureGap } = require("../services/EventBackfill");
const ListenerStateWorker = require("../services/ListenerStateWorker");

const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

const parseBlock = (value, fallback) => {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`"${value}" is not a block number`);
  }
  return parsed;
};

const main = async () => {
  mongoLoader();

  const head = await provider.getBlockNumber();
  const state = await ListenerStateWorker.getState(config.eventListener.jobName);

  const fromBlock = parseBlock(
    process.argv[2],
    state?.lastBlock || config.eventListener.startBlock || 0
  );
  const toBlock = parseBlock(process.argv[3], head);

  logger.info(
    `Backfilling ${fromBlock}..${toBlock} (${measureGap(fromBlock, toBlock)} blocks behind head ${head})`
  );

  const { chunks, events } = await backfill({
    eventList: [],
    fromBlock,
    toBlock,
    onBatch: async ({ from, to, logs }) => {
      logger.info(`  ${from}..${to}: ${logs.length} events`);
    },
  });

  logger.info(`Backfill complete: ${events} events over ${chunks} chunks`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error.stack || error.message);
    process.exit(1);
  });
