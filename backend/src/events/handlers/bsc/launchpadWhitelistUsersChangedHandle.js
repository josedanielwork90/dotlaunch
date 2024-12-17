const services = require("../../services")
const loggerContainer = require("../../../loaders/loggerContainer")
const logger = loggerContainer.get("EVENT_LISTENER_WORKER")

module.exports = async (launchpadsStateChangedData) => {
	const eventLaunchpadAddresses = launchpadsStateChangedData.map((launchpadState) => launchpadState.launchpad)
	const LaunchpadService = new services.launchpad()
	const savedLaunchpadAddresses = await LaunchpadService.getUpdatedActionLaunchpadsFromInputOne({
		launchpadAddresses: eventLaunchpadAddresses,
	})
	let newLaunchpadsStateChanged = launchpadsStateChangedData.filter(
		(item) => savedLaunchpadAddresses.includes(item.launchpad) && item.whitelistUsers.length > 0
	)
	newLaunchpadsStateChanged = newLaunchpadsStateChanged.map((item) => {
		item.whitelistUsers = item.whitelistUsers.filter(
			(user) => user !== "0x0000000000000000000000000000000000000000"
		)
		return item
	})
	const isUpdatedStateOk = await LaunchpadService.saveLaunchpadsWhitelistUsers({
		launchpadsWhitelistUsers: newLaunchpadsStateChanged,
	})

	if (!isUpdatedStateOk) {
		logger.error("Fail to save new launchpads state to db", {
			context: {
				newLaunchpadsStateChanged,
			},
		})
		return true
	}

	return isUpdatedStateOk
}
