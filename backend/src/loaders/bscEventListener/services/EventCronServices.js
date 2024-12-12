const provider = require("../helpers/serviceProvider");
const { getMultiEventsByName } = require("../helpers/transactionHistoryWorker");
const ListenerStateWorker = require("./ListenerStateWorker");
const transactionLogFormatter = require("../helpers/transactionLogFormatter");
const { BSC_EVENT_NAME } = require("../../../helpers/constants");
const config = require("../../../config");
const launchpadDeployerContract = require("../config/smartContract/launchpadDeployer");

module.exports.initListenerStates = async () => {
  const listenerStateData = await ListenerStateWorker.getCronState(
    config.eventListener.jobName
  );
  if (Object.values(listenerStateData) === 0) {
    await ListenerStateWorker.createListenerState(
      config.eventListener.jobName
    );
  }
};

module.exports.getListenerTimestamp = () =>
  ListenerStateWorker.getListenerTimestamp(config.eventListener.jobName);

module.exports.getCronState = () =>
  ListenerStateWorker.getCronState(config.eventListener.jobName);

module.exports.clearForceCron = () =>
  ListenerStateWorker.clearForceCron(config.eventListener.jobName);

module.exports.setForceCron = (block) =>
  ListenerStateWorker.setForceCron(config.eventListener.jobName, block);

module.exports.updateCronState = (state) =>
  ListenerStateWorker.updateCronState(config.eventListener.jobName, state);

module.exports.retrieveMultiEventsByName = async (
  startBlockNumber,
  endBlockNumber
) => {
  const { results, startBlock, endBlock } = await getMultiEventsByName({
    eventList: [
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_CREATED,
        contract: launchpadDeployerContract,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_PARAMETER,
        contract: launchpadDeployerContract,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_STATE_CHANGED,
        contract: launchpadDeployerContract,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_RAISED_CHANGED,
        contract: launchpadDeployerContract
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_ACTION_CHANGED,
        contract: launchpadDeployerContract
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_WHITELIST_USERS_CHANGED,
        contract: launchpadDeployerContract
      }
    ],
    provider,
    startBlockNumber,
    endBlockNumber,
  });

  const [
    launchpadCreatedEvents,
    launchpadDeployedParameterEvents,
    launchpadStateChangedEvents,
    launchpadRaisedChangedEvents,
    launchpadActionChangedEvents,
    launchpadWhitelistUsersChangedEvents,
  ] = results;

  const [
    launchpadCreatedProcessed,
    launchpadDeployedParameterProcessed,
    launchpadStateChangedProcessed,
    launchpadRaisedChangedProcessed,
    launchpadActionChangedProcessed,
    launchpadWhitelistUsersChangedProcessed,
  ] = [
    launchpadCreatedEvents.map(transactionLogFormatter.formatLaunchpadCreated),
    launchpadDeployedParameterEvents.map(
      transactionLogFormatter.formatLaunchpadParameter
    ),
    launchpadStateChangedEvents.map(
      transactionLogFormatter.formatLaunchpadStateChanged
    ),
    launchpadRaisedChangedEvents.map(
      transactionLogFormatter.formatLaunchpadRaisedChanged
    ),
    launchpadActionChangedEvents.map(
      transactionLogFormatter.formatLaunchpadActionChanged
    ),
    launchpadWhitelistUsersChangedEvents.map(
      transactionLogFormatter.formatLaunchpadWhitelistUsersChanged
    )
  ];

  return {
    endBlock,
    startBlock,
    result: [
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_CREATED,
        eventData: launchpadCreatedProcessed,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_PARAMETER,
        eventData: launchpadDeployedParameterProcessed,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_STATE_CHANGED,
        eventData: launchpadStateChangedProcessed,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_RAISED_CHANGED,
        eventData: launchpadRaisedChangedProcessed,
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_ACTION_CHANGED,
        eventData: launchpadActionChangedProcessed
      },
      {
        eventName: BSC_EVENT_NAME.LAUNCHPAD_WHITELIST_USERS_CHANGED,
        eventData: launchpadWhitelistUsersChangedProcessed
      }
    ],
  };
};
