/**
 * Page and event analytics.
 *
 * Loads the tag script lazily and queues anything reported before it is
 * ready, so a slow or blocked script never drops an event and never delays
 * first paint. Disabled entirely unless a measurement id is configured.
 */

const MEASUREMENT_ID = process.env.REACT_APP_ANALYTICS_ID || ""
const SCRIPT_SRC = "https://www.googletagmanager.com/gtag/js"

let loaded = false
let loading = null
const queue = []

const enabled = () => Boolean(MEASUREMENT_ID) && typeof window !== "undefined"

const loadScript = () => {
	if (loading) return loading

	loading = new Promise((resolve, reject) => {
		const script = document.createElement("script")
		script.async = true
		script.src = `${SCRIPT_SRC}?id=${MEASUREMENT_ID}`
		script.onload = () => resolve()
		script.onerror = () => reject(new Error("analytics script blocked"))
		document.head.appendChild(script)
	})

	return loading
}

const push = (...args) => {
	window.dataLayer = window.dataLayer || []
	window.dataLayer.push(args)
}

const flush = () => {
	while (queue.length > 0) {
		const entry = queue.shift()
		push(...entry)
	}
}

/** Initialise the tag. Safe to call more than once. */
export const init = async () => {
	if (!enabled() || loaded) return false

	try {
		await loadScript()
		push("js", new Date())
		push("config", MEASUREMENT_ID, { send_page_view: false })
		loaded = true
		flush()
		return true
	} catch (error) {
		// An ad blocker is a normal condition, not an error worth surfacing.
		return false
	}
}

/** Record a page view. */
export const pageView = (path, title) => {
	if (!enabled()) return
	const entry = ["event", "page_view", { page_path: path, page_title: title }]
	if (loaded) push(...entry)
	else queue.push(entry)
}

/** Record a named event with optional parameters. */
export const track = (name, params = {}) => {
	if (!enabled()) return
	const entry = ["event", name, params]
	if (loaded) push(...entry)
	else queue.push(entry)
}

/** Convenience wrappers for the events the product actually cares about. */
export const trackWalletConnected = (walletType) =>
	track("wallet_connected", { wallet_type: walletType })

export const trackPresaleCreated = (launchpad, type) =>
	track("presale_created", { launchpad, presale_type: type })

export const trackContribution = (launchpad, amount) =>
	track("contribution", { launchpad, value: Number(amount) || 0 })

export default { init, pageView, track }
