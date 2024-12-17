const services = require("../../services");
const loggerContainer = require("../../../loaders/loggerContainer");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

module.exports = async (launchpadsRaisedData) => {
	const eventLaunchpadAddresses = launchpadsRaisedData.map((launchpadRaised) => launchpadRaised.launchpad)
	const LaunchpadService = new services.launchpad()
	const savedLaunchpadAddresses = await LaunchpadService.getUpdatedParameterLaunchpadsFromInputOne({
		launchpadAddresses: eventLaunchpadAddresses,
	})
	const newLaunchpadsRaised = launchpadsRaisedData.filter(
		(launchpadRaised) => savedLaunchpadAddresses.includes(launchpadRaised.launchpad)
	)
	const isUpdatedRaisedOk = await LaunchpadService.saveLaunchpadsParameter({
		launchpadsParameter: newLaunchpadsRaised,
	})

	if (!isUpdatedRaisedOk) {
		logger.error("Fail when save new launchpads to db", {
			context: {
				newLaunchpadsRaised,
			},
		})
		return true
	}

	return isUpdatedRaisedOk
}
