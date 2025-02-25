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
export const clearPriceCache = () => {
	cache.clear()
	seriesCache.clear()
}


const CHART_API = "https://api.coingecko.com/api/v3/coins"
const SERIES_TTL_MS = 15 * 60 * 1000

const seriesCache = new Map()

/**
 * Daily closing prices for the last `days`.
 *
 * Used by the raise chart to plot a dollar line behind the native-coin bars.
 * Cached far longer than the spot price: a daily series does not change
 * minute to minute, and the endpoint is the most rate-limited of the two.
 */
export const getPriceSeries = async (symbol = "bnb", days = 30) => {
	const id = SUPPORTED[symbol.toLowerCase()]
	if (!id) return []

	const key = `${id}:${days}`
	const entry = seriesCache.get(key)
	if (entry && Date.now() - entry.at < SERIES_TTL_MS) return entry.value

	try {
		const response = await axios.get(`${CHART_API}/${id}/market_chart`, {
			params: { vs_currency: "usd", days, interval: "daily" },
			timeout: 8000,
		})

		const points = (response.data?.prices || []).map(([at, price]) => ({
			at,
			price,
		}))

		seriesCache.set(key, { value: points, at: Date.now() })
		return points
	} catch (error) {
		return []
	}
}

/** Closing price nearest a given instant, or null when the series is empty. */
export const priceAt = (series, timestamp) => {
	if (!Array.isArray(series) || series.length === 0) return null

	let closest = series[0]
	let smallest = Math.abs(series[0].at - timestamp)

	for (const point of series) {
		const distance = Math.abs(point.at - timestamp)
		if (distance < smallest) {
			smallest = distance
			closest = point
		}
	}

	return closest.price
}

/** Percentage change across a series, or null when it cannot be computed. */
export const changeOver = (series) => {
	if (!Array.isArray(series) || series.length < 2) return null
	const first = series[0].price
	const last = series[series.length - 1].price
	if (!first) return null
	return ((last - first) / first) * 100
}

export default { getPrice, getPriceSeries, priceAt, changeOver, toUsd, formatUsd, clearPriceCache }
