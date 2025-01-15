import axios from "axios"

/**
 * Native-coin price, for showing raises in dollars as well as BNB.
 *
 * Quotes come from a public price API. Responses are cached in memory for a
 * minute: a list of twenty presales would otherwise fire twenty identical
 * requests as each card rendered, and the free tier rate-limits well below
 * that.
 */

const PRICE_API = "https://api.coingecko.com/api/v3/simple/price"
const CACHE_TTL_MS = 60 * 1000
const SUPPORTED = {
	bnb: "binancecoin",
	eth: "ethereum",
}

const cache = new Map()

const cached = (key) => {
	const entry = cache.get(key)
	if (!entry) return null
	if (Date.now() - entry.at > CACHE_TTL_MS) {
		cache.delete(key)
		return null
	}
	return entry.value
}

const remember = (key, value) => {
	cache.set(key, { value, at: Date.now() })
	return value
}

/**
 * Spot price of `symbol` in USD.
 *
 * Returns null rather than throwing when the quote cannot be fetched: a
 * missing price means the dollar figure is hidden, not that the page fails.
 */
export const getPrice = async (symbol = "bnb") => {
	const id = SUPPORTED[symbol.toLowerCase()]
	if (!id) return null

	const hit = cached(id)
	if (hit !== null) return hit

	try {
		const response = await axios.get(PRICE_API, {
			params: { ids: id, vs_currencies: "usd" },
			timeout: 5000,
		})
		const price = response.data?.[id]?.usd
		if (typeof price !== "number") return null
		return remember(id, price)
	} catch (error) {
		return null
	}
}

/** Convert an amount of native coin to USD, or null when no quote is available. */
export const toUsd = async (amount, symbol = "bnb") => {
	const price = await getPrice(symbol)
	if (price === null) return null
	const value = Number(amount)
	if (!Number.isFinite(value)) return null
	return value * price
}

/** Format a USD figure the way the cards show it. */
export const formatUsd = (value) => {
	if (value === null || value === undefined) return ""
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: value < 1 ? 4 : 2,
	}).format(value)
}

/** Drop every cached quote. Used by tests and by the network switcher. */
export const clearPriceCache = () => cache.clear()

export default { getPrice, toUsd, formatUsd, clearPriceCache }
