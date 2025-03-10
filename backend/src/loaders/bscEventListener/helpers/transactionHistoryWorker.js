const config = require("../../../config");

const MAXIMUM_BLOCK_RANGE = config.eventListener.blockRange || 500;

/**
 * Blocks held back from the head before logs are considered final.
 *
 * On a chain that can reorg this is essential. On a local chain it is
 * actively harmful: anvil only mines when a transaction arrives, so once
 * seeding finishes the head stops moving and anything in the last N blocks
 * would never be indexed at all. `chain.confirmations` is 0 for local
 * development and configurable per network.
 */
const CONFIRMATIONS = config.chain.confirmations || 0;
const DEFAULT_BLOCK_RANGE = 100;

const getLatestBlockNumber = (provider) => provider.getBlockNumber();

module.exports.getTransactionByHash = (txHash, { provider }) =>
  provider.getTransaction(txHash);

module.exports.getEventsByName = async (
  eventName,
  { provider, contract, startBlockNumber, endBlockNumber }
) => {
  let endBlockNum = endBlockNumber;
  let startBlockNum = startBlockNumber;
  if (!endBlockNum) {
    endBlockNum = await getLatestBlockNumber(provider);
    endBlockNum = Math.max(0, endBlockNum - CONFIRMATIONS);
  }

  if (!startBlockNum) {
    // Fall back to the block the contracts were deployed in, so a cold
    // listener replays the full history rather than only the recent tail.
    // Clamped at zero: on a young chain `endBlockNum - DEFAULT_BLOCK_RANGE`
    // goes negative, and a negative fromBlock silently returns the wrong
    // window instead of erroring.
    const configuredStart = config.eventListener.startBlock;
    startBlockNum = Number.isFinite(configuredStart) && configuredStart > 0
      ? configuredStart
      : Math.max(0, endBlockNum - DEFAULT_BLOCK_RANGE);
  } else if (endBlockNum - startBlockNum > MAXIMUM_BLOCK_RANGE) {
    endBlockNum = startBlockNum + MAXIMUM_BLOCK_RANGE;
  }
  if (startBlockNum > endBlockNum) startBlockNum = endBlockNum;

  const filter = contract.filters[eventName]();
  const result = await contract.queryFilter(filter, startBlockNum, endBlockNum);

  return {
    result,
    endBlock: endBlockNum,
    startBlock: startBlockNum,
  };
};

module.exports.getMultiEventsByName = async ({
  eventList,
  provider,
  startBlockNumber,
  endBlockNumber,
}) => {
  let endBlockNum = endBlockNumber;
  let startBlockNum = startBlockNumber;
  if (!endBlockNum) {
    endBlockNum = await getLatestBlockNumber(provider);
    endBlockNum = Math.max(0, endBlockNum - CONFIRMATIONS);
  }

  if (!startBlockNum) {
    // Fall back to the block the contracts were deployed in, so a cold
    // listener replays the full history rather than only the recent tail.
    // Clamped at zero: on a young chain `endBlockNum - DEFAULT_BLOCK_RANGE`
    // goes negative, and a negative fromBlock silently returns the wrong
    // window instead of erroring.
    const configuredStart = config.eventListener.startBlock;
    startBlockNum = Number.isFinite(configuredStart) && configuredStart > 0
      ? configuredStart
      : Math.max(0, endBlockNum - DEFAULT_BLOCK_RANGE);
  } else if (endBlockNum - startBlockNum > MAXIMUM_BLOCK_RANGE) {
    endBlockNum = startBlockNum + MAXIMUM_BLOCK_RANGE;
  }
  if (startBlockNum > endBlockNum) startBlockNum = endBlockNum;

  const results = await Promise.all(
    eventList.map(({ eventName, contract }) =>
      contract.queryFilter(
        contract.filters[eventName](),
        startBlockNum,
        endBlockNum
      )
    )
  );

  return {
    results,
    endBlock: endBlockNum,
    startBlock: startBlockNum,
  };
};
