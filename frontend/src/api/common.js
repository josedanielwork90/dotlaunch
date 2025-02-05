import AxiosService from "./axiosService"

const axiosService = new AxiosService()

export const createCampaignAPI = (token, data) => {
    axiosService.setHeader("Authorization", `Bearer ${token}`)
	return axiosService.post("/launchpads/campaign/create", data)
}

export const getLaunchpadListAPI = (data) => {
	return axiosService.post("/launchpads/list", data)
}

export const getLaunchpadDetailAPI = (launchpadAddr) => {
	return axiosService.get(`/launchpads/${launchpadAddr}`)
}

/**
 * Resolve stored launch metadata by content id.
 *
 * Served by the DotLaunch API rather than a public IPFS gateway, so the app
 * works with no outbound internet access and honours whichever storage driver
 * the API is configured with.
 */
export const getReceiptFromIPFS = (ip) => {
	return axiosService.get(`/storage/${ip}`, { timeout: 5000 })
}
