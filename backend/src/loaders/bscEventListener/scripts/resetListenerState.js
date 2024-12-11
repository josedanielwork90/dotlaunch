const ListenerStateWorker = require("../services/ListenerStateWorker");
const loggerContainer = require("../../loggerContainer");
const config = require("../../../config");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");
const startBlock = Number(process.argv[2]);

const resetState = async () => {
  try {
    const lastCronBlock = startBlock - 1;
    if (lastCronBlock > 0) {
      await ListenerStateWorker.setForceCron(
        config.eventListener.jobName,
        lastCronBlock
      );
      logger.info(`Next startblock: ${lastCronBlock + 1}`);
    } else
      await ListenerStateWorker.setForceCron(config.eventListener.jobName);
    logger.info(`${config.eventListener.jobName}: CronState cleared`);
  } catch (err) {
    logger.error(err);
  }
  process.exit(0);
};

resetState();
