const loggerContainer = require("../../loggerContainer");

const logger = loggerContainer.get("EVENT_LISTENER_WORKER");

/**
 * Counters for the indexing loop.
 *
 * Indexing fails quietly by design - a dropped log means one presale is
 * missing from a list, not an error anyone sees. These counters are what
 * makes that visible: a rising `failed` or a `lastRunAt` that stops moving
 * says the listener is unhealthy long before a user reports a gap.
 */

const state = {
  runs: 0,
  failed: 0,
  eventsSeen: 0,
  eventsQueued: 0,
  lastRunAt: 0,
  lastBlock: 0,
  lastError: null,
  durationsMs: [],
};

const MAX_SAMPLES = 50;

/** Record a completed indexing pass. */
const recordRun = ({ events = 0, queued = 0, lastBlock = 0, durationMs = 0 }) => {
  state.runs += 1;
  state.eventsSeen += events;
  state.eventsQueued += queued;
  state.lastRunAt = Date.now();
  state.lastBlock = lastBlock || state.lastBlock;

  state.durationsMs.push(durationMs);
  if (state.durationsMs.length > MAX_SAMPLES) state.durationsMs.shift();
};

/** Record a pass that threw. */
const recordFailure = (error) => {
  state.failed += 1;
  state.lastError = {
    message: error && error.message ? error.message : String(error),
    at: Date.now(),
  };
  logger.error(`Indexing pass failed: ${state.lastError.message}`);
};

const average = (values) =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const percentile = (values, fraction) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
};

/** Everything the metrics endpoint reports. */
const snapshot = () => ({
  runs: state.runs,
  failed: state.failed,
  failureRate: state.runs === 0 ? 0 : state.failed / state.runs,
  eventsSeen: state.eventsSeen,
  eventsQueued: state.eventsQueued,
  lastRunAt: state.lastRunAt,
  lastBlock: state.lastBlock,
  lastError: state.lastError,
  durationMs: {
    average: average(state.durationsMs),
    p95: percentile(state.durationsMs, 0.95),
    samples: state.durationsMs.length,
  },
});

/**
 * Whether the listener looks alive.
 *
 * A listener that has never run is starting up, not broken; one that ran and
 * then went quiet for several cron periods is broken.
 */
const isHealthy = (staleAfterMs = 5 * 60 * 1000) => {
  if (state.runs === 0) return true;
  return Date.now() - state.lastRunAt < staleAfterMs;
};

/** Reset every counter. Used by tests. */
const reset = () => {
  state.runs = 0;
  state.failed = 0;
  state.eventsSeen = 0;
  state.eventsQueued = 0;
  state.lastRunAt = 0;
  state.lastBlock = 0;
  state.lastError = null;
  state.durationsMs = [];
};

module.exports = { recordRun, recordFailure, snapshot, isHealthy, reset };
