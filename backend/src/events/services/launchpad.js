const models = require("../../models")
const { LAUNCHPAD_ONCHAIN_STATUS } = require("../../helpers/constants")
class LaunchpadService {
	getSavedLaunchpadsFromInputOnes = async ({ launchpadAddresses }) => {
		try {
			const savedLaunchpadsDoc = await models.launchpadInfo.find({
				launchpad: { $in: launchpadAddresses },
				status: { $exists: true },
			})
			return savedLaunchpadsDoc.map((doc) => doc.launchpad)
		} catch (err) {
			return []
		}
	}

	getUpdatedParameterLaunchpadsFromInputOne = async ({ launchpadAddresses }) => {
		try {
			const updatedParameterLaunchpadsDoc = await models.launchpadInfo.find({
				launchpad: { $in: launchpadAddresses },
				tokenSale: { $exists: true },
			})
			return updatedParameterLaunchpadsDoc.map((doc) => doc.launchpad)
		} catch (err) {
			return []
		}
	}

	getUpdatedStateLaunchpadsFromInputOne = async ({ launchpadAddresses }) => {
		try {
			const updatedStateChangedLaunchpadsDoc = await models.launchpadInfo.find({
				launchpad: { $in: launchpadAddresses },
				status: { $eq: LAUNCHPAD_ONCHAIN_STATUS.OPENING.toString() },
			})
			return updatedStateChangedLaunchpadsDoc.map((doc) => doc.launchpad)
		} catch (err) {
			return []
		}
	}

	getUpdatedActionLaunchpadsFromInputOne = async ({ launchpadAddresses }) => {
		try {
			const updatedStateChangedLaunchpadsDoc = await models.launchpadInfo.find({
				launchpad: { $in: launchpadAddresses },
			})
			return updatedStateChangedLaunchpadsDoc.map((doc) => doc.launchpad)
		} catch (err) {
			return []
		}
	}

	saveLaunchpadsParameter = async ({ launchpadsParameter }) => {
		try {
			const bulkUpdateQuery = launchpadsParameter.map((launchpadParameter) => ({
				updateOne: {
					filter: { launchpad: launchpadParameter.launchpad },
					update: { ...launchpadParameter },
					upsert: true,
				},
			}))
			await models.launchpadInfo.bulkWrite(bulkUpdateQuery, { ordered: true })
			return true
		} catch (err) {
			return false
		}
	}

	saveLaunchpadsState = async ({ launchpadsState }) => {
		try {
			const bulkUpdateQuery = launchpadsState.map((launchpadState) => ({
				updateOne: {
					filter: { launchpad: launchpadState.launchpad },
					update: { ...launchpadState },
					upsert: false,
				},
			}))
			await models.launchpadInfo.bulkWrite(bulkUpdateQuery, { ordered: true })
			return true
		} catch (err) {
			return false
		}
	}

	saveLaunchpadsWhitelistUsers = async ({ launchpadsWhitelistUsers }) => {
		try {
			const bulkUpdateQuery = launchpadsWhitelistUsers.map((item) => ({
				updateOne: {
					filter: { launchpad: item.launchpad },
					update:
						item.action === 0
							? { $push: { whitelistUsers: { $each: item.whitelistUsers } } }
							: { $pullAll: { whitelistUsers: item.whitelistUsers } },
					upsert: false,
				},
			}))
			await models.launchpadInfo.bulkWrite(bulkUpdateQuery, { ordered: true })
			return true
		} catch (err) {
			return false
		}
	}

	saveNewLaunchpads = async ({ launchpadsInfo }) => {
		try {
			await models.launchpadInfo.insertMany(launchpadsInfo)
			return true
		} catch (err) {
			return false
		}
	}
}

module.exports = LaunchpadService
