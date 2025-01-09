import axios from "axios"

/**
 * Presale metadata pinning, straight from the browser.
 *
 * The Pinata key is read from the build environment and sent with each
 * request. That is simple, and it is what the reference launchpad we started
 * from did, but it does mean the credential ships inside the bundle.
 */

const PINATA_API = "https://api.pinata.cloud"
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"

const jwt = process.env.REACT_APP_PINATA_JWT || ""

const authHeaders = () => ({
	Authorization: `Bearer ${jwt}`,
	"Content-Type": "application/json",
})

/** Pin a metadata document and return its gateway URL. */
export const pinJSON = async (content, name) => {
	const body = {
		pinataContent: content,
		pinataMetadata: name ? { name } : undefined,
	}

	const response = await axios.post(`${PINATA_API}/pinning/pinJSONToIPFS`, body, {
		headers: authHeaders(),
	})

	const hash = response.data.IpfsHash
	return { hash, url: `${PINATA_GATEWAY}/${hash}` }
}

/** Read a pinned document back through the public gateway. */
export const fetchJSON = async (uriOrHash) => {
	const hash = extractHash(uriOrHash)
	if (!hash) return null

	try {
		const response = await axios.get(`${PINATA_GATEWAY}/${hash}`, { timeout: 8000 })
		return response.data
	} catch (error) {
		return null
	}
}

/** Trailing segment of a metadata URI: its content hash. */
export const extractHash = (uri) => {
	if (!uri) return ""
	const withoutQuery = String(uri).split("?")[0].replace(/\/+$/, "")
	const segments = withoutQuery.split("/")
	return segments[segments.length - 1] || ""
}

/** Whether pinning is configured in this build. */
export const isConfigured = () => Boolean(jwt)

export default { pinJSON, fetchJSON, extractHash, isConfigured }
