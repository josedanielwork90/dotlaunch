const logger = require("../utils/logger").scoped("PRICE");

/**
 * Server-side price cache.
 *
 * The browser was querying the public price API directly, which meant one
 * request per visitor per card and regular rate-limit responses. Polling once
 * here and serving the result to everyone keeps us inside the free tier and
 * gives every client the same number.
 */

const PRICE_API = "https://api.coingecko.com/api/v3/simple/price";
const REFRESH_MS = 60 * 1000;
const IDS = { bnb: "binancecoin", eth: "ethereum" };

const state = {
  prices: {},
  updatedAt: 0,
  timer: null,
};

const fetchPrices = async () => {
  const ids = Object.values(IDS).join(",");
  const url = `${PRICE_API}?ids=${ids}&vs_currencies=usd`;

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Price API returned ${response.status}`);
  }
  return response.json();
};

/** Refresh the cache once. Never throws; a failed refresh keeps the old values. */
const refresh = async () => {
  try {
    const payload = await fetchPrices();
    const next = {};
    for (const [symbol, id] of Object.entries(IDS)) {
      const usd = payload?.[id]?.usd;
      if (typeof usd === "number") next[symbol] = usd;
    }
    if (Object.keys(next).length > 0) {
      state.prices = next;
      state.updatedAt = Date.now();
    }
    return true;
  } catch (error) {
    logger.warn(`Price refresh failed: ${error.message}`);
    return false;
  }
};

/** Start polling. Safe to call more than once. */
const start = () => {
  if (state.timer) return state.timer;
  refresh();
  state.timer = setInterval(refresh, REFRESH_MS);
  state.timer.unref();
  return state.timer;
};

/** Stop polling, so a test or a shutdown does not leave the process alive. */
const stop = () => {
  if (!state.timer) return;
  clearInterval(state.timer);
  state.timer = null;
};

/** Latest cached prices, with the age of the quote. */
const snapshot = () => ({
  prices: { ...state.prices },
  updatedAt: state.updatedAt,
  stale: state.updatedAt === 0 || Date.now() - state.updatedAt > 5 * REFRESH_MS,
});

module.exports = { start, stop, refresh, snapshot };
