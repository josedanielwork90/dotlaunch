const services = require("../../services");
const loggerContainer = require("../../../loaders/loggerContainer");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");
const { LAUNCHPAD_ONCHAIN_STATUS } = require("../../../helpers/constants");

module.exports = async (launchpadDeployedEventList) => {
  const eventLaunchpadAddresses = launchpadDeployedEventList.map(
    (launchpadDeployedEvent) => launchpadDeployedEvent.launchpad
  );
  const LaunchpadService = new services.launchpad();

  const savedLaunchpadsAddress =
    await LaunchpadService.getSavedLaunchpadsFromInputOnes({
      launchpadAddresses: eventLaunchpadAddresses,
    });

  const newLaunchpadsInfo = launchpadDeployedEventList.filter(
    (launchpadDeployedEvent) => {
      return !savedLaunchpadsAddress.includes(launchpadDeployedEvent.launchpad);
    }
  );

  if (newLaunchpadsInfo.length === 0) {
    return true;
  }

  const isSavedNewLaunchpadsOk = await LaunchpadService.saveNewLaunchpads({
    launchpadsInfo: newLaunchpadsInfo.map((launchpadsInfo) => ({
      ...launchpadsInfo,
      kyc: false,
      audit: false,
      status: LAUNCHPAD_ONCHAIN_STATUS.OPENING,
    })),
  });

  if (!isSavedNewLaunchpadsOk) {
    logger.error("Fail when save new launchpads to db", {
      context: {
        newLaunchpadsInfo,
      },
    });
    return true;
  }

  return isSavedNewLaunchpadsOk;
};
