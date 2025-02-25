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


/**
 * Pin a project logo or banner.
 *
 * Images go up as multipart rather than JSON, and the create wizard shows a
 * progress bar, so the upload has to report bytes as they go rather than
 * resolving once at the end.
 */
export const pinFile = async (file, { name, onProgress } = {}) => {
	const form = new FormData()
	form.append("file", file)
	if (name) {
		form.append("pinataMetadata", JSON.stringify({ name }))
	}

	const response = await axios.post(`${PINATA_API}/pinning/pinFileToIPFS`, form, {
		headers: {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "multipart/form-data",
		},
		maxBodyLength: Infinity,
		onUploadProgress: (event) => {
			if (!onProgress || !event.total) return
			onProgress(Math.round((event.loaded / event.total) * 100))
		},
	})

	const hash = response.data.IpfsHash
	return { hash, url: `${PINATA_GATEWAY}/${hash}` }
}

/** Reject anything the gateway will not serve as an image, before uploading. */
export const validateImage = (file, maxBytes = 2 * 1024 * 1024) => {
	if (!file) return "Choose a file"
	if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type)) {
		return "Logos must be PNG, JPEG, GIF, WebP or SVG"
	}
	if (file.size > maxBytes) {
		return `Logos must be under ${Math.round(maxBytes / 1024)}KB`
	}
	return null
}

/** Resolve a URI to something an <img> tag can load. */
export const imageUrl = (uriOrHash) => {
	if (!uriOrHash) return ""
	if (String(uriOrHash).startsWith("http")) return String(uriOrHash)
	return `${PINATA_GATEWAY}/${extractHash(uriOrHash)}`
}

export default { pinJSON, pinFile, fetchJSON, extractHash, imageUrl, validateImage, isConfigured }
