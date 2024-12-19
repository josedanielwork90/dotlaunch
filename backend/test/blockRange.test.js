const helpers = require("../src/loaders/bscEventListener/helpers");

/**
 * Log-window arithmetic.
 *
 * The listener asks the node for logs between two block numbers. Ask for too
 * wide a window and the RPC rejects the call; ask for the wrong window and
 * launches go missing entirely. This is the part of indexing with no
 * observable symptom when it is wrong - the API just serves fewer presales
 * than exist - so it gets tested directly.
 */

/** A contract stub that records the window it was queried with. */
const contractStub = () => {
  const calls = [];
  return {
    calls,
    filters: { someEvent: () => ({ topics: [] }) },
    queryFilter: async (filter, from, to) => {
      calls.push({ from, to });
      return [];
    },
  };
};

describe("getEventsByName", () => {
  it("returns the window it queried", async () => {
    const contract = contractStub();

    const { startBlock, endBlock } = await helpers.getEventsByName("someEvent", {
      contract,
      startBlockNumber: 100,
      endBlockNumber: 200,
    });

    expect(startBlock).toBe(100);
    expect(endBlock).toBe(200);
  });

  it("passes the window straight to the node", async () => {
    const contract = contractStub();

    await helpers.getEventsByName("someEvent", {
      contract,
      startBlockNumber: 100,
      endBlockNumber: 200,
    });

    expect(contract.calls).toHaveLength(1);
    expect(contract.calls[0]).toEqual({ from: 100, to: 200 });
  });

  it("caps a window wider than the configured maximum", async () => {
    const contract = contractStub();

    const { startBlock, endBlock } = await helpers.getEventsByName("someEvent", {
      contract,
      startBlockNumber: 0,
      endBlockNumber: 10_000_000,
    });

    expect(endBlock - startBlock).toBeLessThanOrEqual(1000);
  });

  it("keeps the start when capping, so nothing is skipped", async () => {
    const contract = contractStub();

    const { startBlock } = await helpers.getEventsByName("someEvent", {
      contract,
      startBlockNumber: 4242,
      endBlockNumber: 10_000_000,
    });

    expect(startBlock).toBe(4242);
  });

  it("returns the logs the node produced", async () => {
    const contract = contractStub();

    const { result } = await helpers.getEventsByName("someEvent", {
      contract,
      startBlockNumber: 1,
      endBlockNumber: 2,
    });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("getMultiEventsByName", () => {
  it("queries every contract over the same window", async () => {
    const first = contractStub();
    const second = contractStub();

    await helpers.getMultiEventsByName({
      eventList: [
        { eventName: "someEvent", contract: first },
        { eventName: "someEvent", contract: second },
      ],
      startBlockNumber: 500,
      endBlockNumber: 600,
    });

    expect(first.calls[0]).toEqual({ from: 500, to: 600 });
    expect(second.calls[0]).toEqual({ from: 500, to: 600 });
  });

  it("returns one result array per contract", async () => {
    const { results } = await helpers.getMultiEventsByName({
      eventList: [
        { eventName: "someEvent", contract: contractStub() },
        { eventName: "someEvent", contract: contractStub() },
      ],
      startBlockNumber: 1,
      endBlockNumber: 2,
    });

    expect(results).toHaveLength(2);
  });
});
