const { BSC_EVENT_NAME } = require("../../../helpers/constants");

module.exports = async (job) => {
  const eventName = job.data.eventType;
  const eventData = job.data.eventData;
  const eventHandleByName = {
    [BSC_EVENT_NAME.LAUNCHPAD_CREATED]: require("./launchpadDeployerHandle"),
    [BSC_EVENT_NAME.LAUNCHPAD_PARAMETER]: require("./launchpadParameterHandle"),
    [BSC_EVENT_NAME.LAUNCHPAD_STATE_CHANGED]: require("./launchpadStateChangedHandle"),
    [BSC_EVENT_NAME.LAUNCHPAD_RAISED_CHANGED]: require("./launchpadRaisedChangedHandle"),
    [BSC_EVENT_NAME.LAUNCHPAD_ACTION_CHANGED]: require("./launchpadActionChangedHandle"),
    [BSC_EVENT_NAME.LAUNCHPAD_WHITELIST_USERS_CHANGED]: require("./launchpadWhitelistUsersChangedHandle")
  };

  return eventHandleByName[eventName](eventData);
};
