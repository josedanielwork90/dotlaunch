const services = require("../../services");
const loggerContainer = require("../../../loaders/loggerContainer");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

module.exports = async (launchpadsStateChangedData) => {
  const eventLaunchpadAddresses = launchpadsStateChangedData.map(
    (launchpadState) => launchpadState.launchpad
  );
  const LaunchpadService = new services.launchpad();
  const savedLaunchpadAddresses =
    await LaunchpadService.getUpdatedActionLaunchpadsFromInputOne({
      launchpadAddresses: eventLaunchpadAddresses,
    });
  const newLaunchpadsStateChanged = launchpadsStateChangedData.filter(
    (launchpadParameter) => savedLaunchpadAddresses.includes(launchpadParameter.launchpad)
  );
  const isUpdatedStateOk = await LaunchpadService.saveLaunchpadsState({
    launchpadsState: newLaunchpadsStateChanged,
  });

  if (!isUpdatedStateOk) {
    logger.error("Fail to save new launchpads state to db", {
      context: {
        newLaunchpadsStateChanged,
      },
    });
    return true;
  }

  return isUpdatedStateOk;
};
