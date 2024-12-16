const services = require("../../services");
const loggerContainer = require("../../../loaders/loggerContainer");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

module.exports = async (launchpadParametersData) => {
  const eventLaunchpadAddresses = launchpadParametersData.map(
    (launchpadParameter) => launchpadParameter.launchpad
  );
  const LaunchpadService = new services.launchpad();
  const savedLaunchpadAddresses =
    await LaunchpadService.getUpdatedParameterLaunchpadsFromInputOne({
      launchpadAddresses: eventLaunchpadAddresses,
    });
  const newLaunchpadsParameter = launchpadParametersData.filter(
    (launchpadParameter) => savedLaunchpadAddresses.includes(launchpadParameter.launchpad)
  );
  const isUpdatedParameterOk = await LaunchpadService.saveLaunchpadsParameter({
    launchpadsParameter: newLaunchpadsParameter,
  });

  if (!isUpdatedParameterOk) {
    logger.error("Fail when save new launchpads to db", {
      context: {
        newLaunchpadsParameter,
      },
    });
    return true;
  }

  return isUpdatedParameterOk;
};
