const loggerContainer = require("../loggerContainer");
const { CronJob } = require("cron");
const EventEmitter = require("events");
const EventCronServices = require("./services/EventCronServices");
const { BSC_EVENT_NAME } = require("../../helpers/constants");
const config = require("../../config");
const { queueList: bullQueueList } = require("../queue");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

const CRONJOB_TIMEOUT_BYSEC = config.eventListener.timeoutSeconds || 60;
const CRON_PATTERN = config.eventListener.cronPattern || "*/30 * * * * *";

const MAX_EVENTNUM_PERMSG = 500;
const queueList = {};
const queueRunningFlag = {};
const eventEmitter = new EventEmitter();

let isFirstRun = true;
let isCronHandlerTimeout = false;
let job;
let isJobRunning = false;
let cronTimeoutFunc;
let lastListenedBlock;
let lastFinishedBlock;
let lastStartBlock;
let totalSQSMsgSent = 0;
let totalEventMsgSent = 0;

const isMessageQueueFree = () => {
  const props = Object.keys(queueList);
  for (let i = 0; i < props.length; i += 1) {
    if (Array.isArray(queueList[props[i]]) && queueList[props[i]].length)
      return false;
  }
  return true;
};

const sendDataToBroke = async (eventType) => {
  if (!queueRunningFlag[eventType]) {
    queueRunningFlag[eventType] = true;
    const dataLength =
      queueList[eventType].length > MAX_EVENTNUM_PERMSG
        ? MAX_EVENTNUM_PERMSG
        : queueList[eventType].length;
    if (dataLength) {
      const eventData = queueList[eventType].slice(0, dataLength);
      await bullQueueList.bscContractEvent.send({
        data: {
          eventType,
          eventData,
        },
      });
      totalEventMsgSent += dataLength;
      totalSQSMsgSent += 1;
      logger.info(
        `SQS Msgs sent: ${totalSQSMsgSent} - Total Event Msgs sent: ${totalEventMsgSent}`
      );
      queueList[eventType].splice(0, dataLength);
    }
    queueRunningFlag[eventType] = false;
    eventEmitter.emit(eventType);
  }
};

// Send to SQS
const handleData = async (eventType, data) => {
  try {
    if (!queueList[eventType]) queueList[eventType] = [];
    if (Array.isArray(data)) {
      queueList[eventType] = queueList[eventType].concat(data);
    } else if (data) queueList[eventType].push(data);
    if (queueList[eventType].length) await sendDataToBroke(eventType);
  } catch (err) {
    logger.error("SQS Sender Failed!");
    logger.error(err);
    process.exit(1);
  }
};

const clearCronTimeout = () => {
  clearTimeout(cronTimeoutFunc);
};

const setCronTimeout = () => {
  clearCronTimeout();
  cronTimeoutFunc = setTimeout(() => {
    logger.warn("Task execution timeout!");
    isCronHandlerTimeout = true;
    job.stop();
  }, CRONJOB_TIMEOUT_BYSEC * 1000);
};

const ontickTask = async () => {
  if (!isJobRunning) {
    isJobRunning = true;
    setCronTimeout();
    try {
      const isQueueFree = isMessageQueueFree();
      if (isQueueFree) {
        const { lastCronBlock, isForcedCron } =
          await EventCronServices.getCronState();

        if (lastFinishedBlock && !isForcedCron) {
          await EventCronServices.updateCronState(lastFinishedBlock);
          logger.info(
            `[Cronjob] From ${lastStartBlock} to ${lastFinishedBlock}`
          );
          lastListenedBlock = lastFinishedBlock + 1;
          lastFinishedBlock = null;
          lastStartBlock = null;
        } else {
          lastListenedBlock = lastCronBlock ? lastCronBlock + 1 : null;
        }
        if (isFirstRun || isForcedCron) {
          logger.info("Cronjob for past events started");
          if (isForcedCron) await EventCronServices.clearForceCron();
          logger.info(`Last cronjob ended at block ${lastCronBlock}`);
          isFirstRun = false;
        }
        const { startBlock, endBlock, result } =
          await EventCronServices.retrieveMultiEventsByName(lastListenedBlock);

        let receivedCount = 0;
        for (let idx = 0, len = result.length; idx < len; idx += 1) {
          if (result[idx].eventData.length) {
            eventEmitter.emit(result[idx].eventName, result[idx].eventData);
            receivedCount += result[idx].eventData.length;
          }
        }

        if (receivedCount) logger.info(`Received event msgs: ${receivedCount}`);

        lastFinishedBlock = endBlock;
        lastStartBlock = startBlock;
      }
    } catch (err) {
      logger.error("Cronjob Error!");
      logger.error(err);
    }
    clearCronTimeout();
    isJobRunning = false;
  }
};

const onStopTask = () => {
  isJobRunning = false;
  if (isCronHandlerTimeout) {
    job.start();
    isCronHandlerTimeout = false;
  }
};

const eventLoader = () => {
  logger.info("Event Listener service started");
  logger.info(`Chain RPC endpoint: ${config.chain.rpcUrl}`);
  logger.info(
    `ADDRESS_LAUNCHPAD_DEPLOYER: ${config.contracts.launchpadDeployer}`
  );
  logger.info(`CRON_PATTERN: ${CRON_PATTERN}`);
  logger.info(`CRON_REDUCE_RANGE: ${config.eventListener.reduceRange || 0}`);

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_CREATED, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_CREATED, data);
  });

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_PARAMETER, data);
  });

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_STATE_CHANGED, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_STATE_CHANGED, data);
  });

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_RAISED_CHANGED, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_RAISED_CHANGED, data)
  })

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_ACTION_CHANGED, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_ACTION_CHANGED, data)
  })

  eventEmitter.on(BSC_EVENT_NAME.LAUNCHPAD_WHITELIST_USERS_CHANGED, async (data) => {
    await handleData(BSC_EVENT_NAME.LAUNCHPAD_WHITELIST_USERS_CHANGED, data)
  })

  job = new CronJob(
    CRON_PATTERN,
    ontickTask,
    onStopTask,
    true,
    "Asia/Ho_Chi_Minh"
  );
};

module.exports = eventLoader;
