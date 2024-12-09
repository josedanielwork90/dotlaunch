const ethers = require("ethers");

const config = require("../../../config");
const { getNumberFromBN } = require("../../../helpers/bn");

/**
 * Event listener helpers.
 *
 * The provider, the log-window arithmetic and the per-event formatters all
 * live here for now. They are only used by loader.js, so keeping them in one
 * place saves a lot of import noise while the indexing path is still moving.
 */

const RPC_ENDPOINT = config.chain.rpcUrl;
const MAXIMUM_BLOCK_RANGE = config.eventListener.blockRange || 500;
const DEFAULT_BLOCK_RANGE = 100;

// ── provider ──────────────────────────────────────────────────────────────

const getProviderByUrl = (url) => {
  switch (true) {
    case url.indexOf("ws") === 0:
      return "WebSocketProvider";
    case url.indexOf("http") === 0:
      return "JsonRpcProvider";
    default:
      return "IpcProvider";
  }
};

const provider = new ethers.providers[getProviderByUrl(RPC_ENDPOINT)](
  RPC_ENDPOINT
);

// ── block windows ─────────────────────────────────────────────────────────

const getLatestBlockNumber = () => provider.getBlockNumber();

/**
 * Resolve the window of blocks to query.
 *
 * Without an explicit start the listener looks back a fixed number of blocks
 * from the head; with one, the window is capped so a cold start does not ask
 * the node for the entire chain in a single call.
 */
const resolveBlockRange = async ({ startBlockNumber, endBlockNumber }) => {
  let endBlockNum = endBlockNumber;
  let startBlockNum = startBlockNumber;

  if (!endBlockNum) {
    endBlockNum = await getLatestBlockNumber();
  }

  if (!startBlockNum) {
    startBlockNum = endBlockNum - DEFAULT_BLOCK_RANGE;
  } else if (endBlockNum - startBlockNum > MAXIMUM_BLOCK_RANGE) {
    endBlockNum = startBlockNum + MAXIMUM_BLOCK_RANGE;
  }

  return { startBlockNum, endBlockNum };
};

const getTransactionByHash = (txHash) => provider.getTransaction(txHash);

const getEventsByName = async (
  eventName,
  { contract, startBlockNumber, endBlockNumber }
) => {
  const { startBlockNum, endBlockNum } = await resolveBlockRange({
    startBlockNumber,
    endBlockNumber,
  });

  const filter = contract.filters[eventName]();
  const result = await contract.queryFilter(filter, startBlockNum, endBlockNum);

  return { result, endBlock: endBlockNum, startBlock: startBlockNum };
};

const getMultiEventsByName = async ({
  eventList,
  startBlockNumber,
  endBlockNumber,
}) => {
  const { startBlockNum, endBlockNum } = await resolveBlockRange({
    startBlockNumber,
    endBlockNumber,
  });

  const results = await Promise.all(
    eventList.map(({ eventName, contract }) =>
      contract.queryFilter(
        contract.filters[eventName](),
        startBlockNum,
        endBlockNum
      )
    )
  );

  return { results, endBlock: endBlockNum, startBlock: startBlockNum };
};

// ── log formatters ────────────────────────────────────────────────────────

const formatLaunchpadCreated = (log) => ({
  user: log.args.deployer,
  tokenSale: log.args.tokenSale,
  tokenPayment: log.args.tokenPayment,
  launchpad: log.args.launchpad,
  launchPadType: Number(log.args.launchPadType),
  uriData: String(log.args.uriData),
  refundWhenFinish: String(log.args.refundWhenFinish) === "true",
  startTime: getNumberFromBN(log.args.startTime) * 1000,
  endTime: getNumberFromBN(log.args.endTime) * 1000,
  claimTime: getNumberFromBN(log.args.claimTime) * 1000,
  transactionHash: log.transactionHash,
  adminTokenSaleFee: String(log.args.adminTokenSaleFee),
});

const formatLaunchpadParameter = (log) => ({
  launchpad: log.args.launchpad,
  softcap: String(log.args.softcap),
  hardcap: String(log.args.hardcap),
  presaleRate: String(log.args.presaleRate),
  listingRate: String(log.args.listingRate),
  minBuyPerParticipant: String(log.args.minBuyPerParticipant),
  maxBuyPerParticipant: String(log.args.maxBuyPerParticipant),
  transactionHash: log.transactionHash,
});

const formatLaunchpadStateChanged = (log) => ({
  launchpad: log.args.launchpad,
  status: getNumberFromBN(log.args.state),
  transactionHash: log.transactionHash,
});

const formatLaunchpadRaisedChanged = (log) => ({
  launchpad: log.args.launchpad,
  totalRaised: String(log.args.newRaisedAmount),
  totalNeedToRaised: String(log.args.totalNeedToRaised),
});

module.exports = {
  provider,
  getTransactionByHash,
  getEventsByName,
  getMultiEventsByName,
  formatLaunchpadCreated,
  formatLaunchpadParameter,
  formatLaunchpadStateChanged,
  formatLaunchpadRaisedChanged,
};
