/**
 * Block-range selection for the event listener.
 *
 * This is the logic that decides which slice of chain history to scan on
 * each tick. Two live bugs came from here, and both were invisible in
 * normal operation - the listener kept running, it just quietly indexed the
 * wrong blocks - so each has a test that fails if it returns.
 */

const loadWorker = (env = {}) => {
  jest.resetModules();

  const saved = { ...process.env };
  Object.keys(env).forEach((key) => {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });

  try {
    // eslint-disable-next-line global-require
    return require("../../../backend/src/loaders/bscEventListener/helpers/transactionHistoryWorker");
  } finally {
    process.env = saved;
  }
};

/** A provider whose head sits at `head`. */
const providerAt = (head) => ({
  getBlockNumber: async () => head,
});

/** A contract that records the range it was queried with. */
const recordingContract = () => {
  const calls = [];
  return {
    calls,
    filters: { someEvent: () => ({}) },
    queryFilter: async (filter, from, to) => {
      calls.push({ from, to });
      return [];
    },
  };
};

const eventListFor = (contract) => [
  { eventName: "someEvent", contract },
];

describe("getMultiEventsByName", () => {
  describe("confirmation lag", () => {
    /**
     * Regression: the head was reduced by a hardcoded 5 blocks. On a chain
     * that only mines when a transaction arrives, the head stops moving once
     * seeding finishes, so the final blocks were never scanned - one seeded
     * presale never appeared in the app at all.
     */
    it("scans right up to the head when no confirmations are required", async () => {
      const worker = loadWorker({ CHAIN_CONFIRMATIONS: "0" });
      const contract = recordingContract();

      const { endBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(88),
        startBlockNumber: 84,
      });

      expect(endBlock).toBe(88);
      expect(contract.calls[0]).toEqual({ from: 84, to: 88 });
    });

    it("holds back exactly the configured number of confirmations", async () => {
      const worker = loadWorker({ CHAIN_CONFIRMATIONS: "12" });
      const contract = recordingContract();

      const { endBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(1000),
        startBlockNumber: 900,
      });

      expect(endBlock).toBe(988);
    });

    it("never produces a negative end block on a young chain", async () => {
      const worker = loadWorker({ CHAIN_CONFIRMATIONS: "12" });
      const contract = recordingContract();

      const { endBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(3),
        startBlockNumber: 0,
      });

      expect(endBlock).toBeGreaterThanOrEqual(0);
    });
  });

  describe("cold start", () => {
    /**
     * Regression: with no stored cursor the scan began at `head - 100`,
     * which is negative on a fresh chain. A negative fromBlock does not
     * error - it silently returns a different window - so early launches
     * were missed with no sign anything was wrong.
     */
    it("never starts below block zero", async () => {
      const worker = loadWorker({
        CHAIN_CONFIRMATIONS: "0",
        EVENT_LISTENER_START_BLOCK: undefined,
        DEPLOYMENTS_DIR: "/nonexistent",
      });
      const contract = recordingContract();

      const { startBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(83),
        startBlockNumber: null,
      });

      expect(startBlock).toBeGreaterThanOrEqual(0);
      expect(contract.calls[0].from).toBeGreaterThanOrEqual(0);
    });

    it("starts from the configured deployment block when one is known", async () => {
      const worker = loadWorker({
        CHAIN_CONFIRMATIONS: "0",
        EVENT_LISTENER_START_BLOCK: "27",
      });
      const contract = recordingContract();

      const { startBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(83),
        startBlockNumber: null,
      });

      expect(startBlock).toBe(27);
    });
  });

  describe("range capping", () => {
    /**
     * Public RPC nodes reject `eth_getLogs` over a wide range, so a listener
     * catching up from cold has to walk forward in bounded steps rather than
     * asking for the whole history at once.
     */
    it("caps a single scan at the configured maximum", async () => {
      const worker = loadWorker({
        CHAIN_CONFIRMATIONS: "0",
        EVENT_LISTENER_BLOCK_RANGE: "1000",
      });
      const contract = recordingContract();

      const { startBlock, endBlock } = await worker.getMultiEventsByName({
        eventList: eventListFor(contract),
        provider: providerAt(500000),
        startBlockNumber: 1,
      });

      expect(endBlock - startBlock).toBeLessThanOrEqual(1000);
    });

    it("makes forward progress when capped, so catch-up terminates", async () => {
      const worker = loadWorker({
        CHAIN_CONFIRMATIONS: "0",
        EVENT_LISTENER_BLOCK_RANGE: "1000",
      });

      let cursor = 1;
      const head = 5000;

      for (let i = 0; i < 10 && cursor < head; i += 1) {
        const contract = recordingContract();
        // eslint-disable-next-line no-await-in-loop
        const { endBlock } = await worker.getMultiEventsByName({
          eventList: eventListFor(contract),
          provider: providerAt(head),
          startBlockNumber: cursor,
        });

        expect(endBlock).toBeGreaterThan(cursor);
        cursor = endBlock + 1;
      }

      expect(cursor).toBeGreaterThan(head);
    });
  });

  describe("querying", () => {
    it("queries every event in the list over the same range", async () => {
      const worker = loadWorker({ CHAIN_CONFIRMATIONS: "0" });
      const a = recordingContract();
      const b = recordingContract();

      await worker.getMultiEventsByName({
        eventList: [
          { eventName: "someEvent", contract: a },
          { eventName: "someEvent", contract: b },
        ],
        provider: providerAt(50),
        startBlockNumber: 10,
      });

      expect(a.calls).toEqual([{ from: 10, to: 50 }]);
      expect(b.calls).toEqual([{ from: 10, to: 50 }]);
    });

    it("returns one result slot per requested event", async () => {
      const worker = loadWorker({ CHAIN_CONFIRMATIONS: "0" });

      const { results } = await worker.getMultiEventsByName({
        eventList: [
          { eventName: "someEvent", contract: recordingContract() },
          { eventName: "someEvent", contract: recordingContract() },
          { eventName: "someEvent", contract: recordingContract() },
        ],
        provider: providerAt(50),
        startBlockNumber: 10,
      });

      expect(results).toHaveLength(3);
    });
  });
});
