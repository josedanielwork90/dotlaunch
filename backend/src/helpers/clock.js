const config = require("../config");

/**
 * The application clock.
 *
 * Sale state is derived by comparing a presale's window against "now", and
 * that comparison has to use the same instant the rest of the system uses.
 * In the seeded demo environment the chain and the web app are both pinned
 * to a fixed instant, so reading the system clock here silently classifies
 * every seeded sale as long finished: nothing is ever "upcoming" or "active"
 * and the status filters return an empty list.
 *
 * Mirrors `frontend/src/utils/runtimeConfig.tsx`, which does the same thing
 * for the browser.
 */

/** Parsed FIXED_NOW, or null when the system clock should be used. */
const fixedNow = (() => {
  const raw = config.demo.fixedNow;
  if (!raw) return null;

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
})();

/**
 * Current time in milliseconds since the epoch.
 *
 * @returns {number}
 */
const now = () => (fixedNow === null ? Date.now() : fixedNow);

/** Current time in whole seconds, for comparing against chain timestamps. */
const nowSeconds = () => Math.floor(now() / 1000);

/** True when the clock is pinned rather than following the system time. */
const isFrozen = () => fixedNow !== null;

module.exports = { now, nowSeconds, isFrozen };
