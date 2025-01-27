/**
 * Placeholder presale data.
 *
 * The list and detail views are being built before the indexer exists, so
 * they render from this instead of the API. The shape deliberately matches
 * what `/launchpads/list` is specified to return, so swapping the source over
 * later is a one-line change in the page rather than a rewrite of the view.
 *
 * Delete this once the API is serving real records.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const base = Date.now();

export const MOCK_LAUNCHPADS = [
  {
    launchpad: "0xAB1954B077a42564c1bade161163C336D3AFbc6a",
    user: "0x1d1479C185d32EB90533a08b36B3CFa5F84A0E6B",
    tokenSale: "0x55d398326f99059fF775485246999027B3197955",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    name: "Meta Inu",
    symbol: "MENU",
    decimals: 9,
    launchPadType: 0,
    status: "0",
    softcap: "20000000000000000000",
    hardcap: "130000000000000000000",
    presaleRate: "140000",
    listingRate: "120000",
    minBuyPerParticipant: "100000000000000000",
    maxBuyPerParticipant: "5000000000000000000",
    totalRaised: "0",
    totalDeposits: "0",
    startTime: base + 2 * DAY,
    endTime: base + 9 * DAY,
    claimTime: base + 10 * DAY,
    uriData: "ipfs://mock-meta-inu",
    kyc: true,
    audit: false,
  },
  {
    launchpad: "0x2C4bE3E7b3E4dB4DA1F0DAE6Bf5eF2B5c04A1eF1",
    user: "0x1d1479C185d32EB90533a08b36B3CFa5F84A0E6B",
    tokenSale: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    name: "Tokyo Millions",
    symbol: "TOMI",
    decimals: 18,
    launchPadType: 0,
    status: "0",
    softcap: "50000000000000000000",
    hardcap: "150000000000000000000",
    presaleRate: "40000",
    listingRate: "36000",
    minBuyPerParticipant: "100000000000000000",
    maxBuyPerParticipant: "10000000000000000000",
    totalRaised: "58000000000000000000",
    totalDeposits: "58000000000000000000",
    startTime: base - 2 * DAY,
    endTime: base + 5 * DAY,
    claimTime: base + 6 * DAY,
    uriData: "ipfs://mock-tokyo-millions",
    kyc: true,
    audit: true,
  },
  {
    launchpad: "0x9F3aC6Cb1B54ba2f2E3B7f0F0a8bcE60d7a3E4D2",
    user: "0x8aF0C4dE4dE5b7A1eBa53e6A0f7Cc1F3B2A9d0e4",
    tokenSale: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    name: "Audit Coin",
    symbol: "AUDT",
    decimals: 18,
    launchPadType: 1,
    status: "1",
    softcap: "10000000000000000000",
    hardcap: "10000000000000000000",
    presaleRate: "25000",
    listingRate: "22500",
    minBuyPerParticipant: "50000000000000000",
    maxBuyPerParticipant: "2000000000000000000",
    totalRaised: "12400000000000000000",
    totalDeposits: "12400000000000000000",
    startTime: base - 12 * DAY,
    endTime: base - 4 * DAY,
    claimTime: base - 3 * DAY,
    uriData: "ipfs://mock-audit-coin",
    kyc: false,
    audit: true,
  },
  {
    launchpad: "0x44Ea1b2E86bE1f8D0D9c5b8a3D2E7F1c6A0b9E33",
    user: "0x8aF0C4dE4dE5b7A1eBa53e6A0f7Cc1F3B2A9d0e4",
    tokenSale: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
    tokenPayment: "0x0000000000000000000000000000000000000000",
    name: "Blocksync",
    symbol: "BSYN",
    decimals: 18,
    launchPadType: 0,
    status: "2",
    softcap: "30000000000000000000",
    hardcap: "80000000000000000000",
    presaleRate: "60000",
    listingRate: "54000",
    minBuyPerParticipant: "100000000000000000",
    maxBuyPerParticipant: "4000000000000000000",
    totalRaised: "4000000000000000000",
    totalDeposits: "4000000000000000000",
    startTime: base - 20 * DAY,
    endTime: base - 13 * DAY,
    claimTime: base - 12 * DAY,
    uriData: "ipfs://mock-blocksync",
    kyc: false,
    audit: false,
  },
];

/** Metadata documents, keyed the way the IPFS gateway would key them. */
export const MOCK_METADATA = {
  "mock-meta-inu": {
    description:
      "Meta Inu transports players to a world in which a major technological transformation has taken place.",
    website: "https://example.invalid/meta-inu",
    twitter: "https://twitter.com/example",
    telegram: "https://t.me/example",
    logo: "https://example.invalid/logo/meta-inu.png",
  },
  "mock-tokyo-millions": {
    description:
      "Tokyo Millions is a community-run index of mid-cap BSC assets with a fixed quarterly rebalance.",
    website: "https://example.invalid/tokyo",
    twitter: "https://twitter.com/example",
    telegram: "https://t.me/example",
    logo: "https://example.invalid/logo/tokyo.png",
  },
};

/** Paginate the mock set the same way the API will. */
export const listMockLaunchpads = ({ page = 0, size = 6, filter = {} } = {}) => {
  let rows = [...MOCK_LAUNCHPADS];

  if (filter.user) {
    rows = rows.filter(
      (row) => row.user.toLowerCase() === String(filter.user).toLowerCase()
    );
  }
  if (filter.launchPadType !== undefined) {
    rows = rows.filter((row) => row.launchPadType === filter.launchPadType);
  }
  if (filter.tokenSale) {
    rows = rows.filter(
      (row) =>
        row.tokenSale.toLowerCase() === String(filter.tokenSale).toLowerCase()
    );
  }

  const offset = page * size;

  return {
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
    currentPage: page,
    launchpads: rows.slice(offset, offset + size),
  };
};

/** Look one presale up by address. */
export const getMockLaunchpad = (address) =>
  MOCK_LAUNCHPADS.find(
    (row) => row.launchpad.toLowerCase() === String(address).toLowerCase()
  ) || null;

/** Resolve a mock metadata URI. */
export const getMockMetadata = (uri) => {
  const key = String(uri).replace("ipfs://", "");
  return MOCK_METADATA[key] || null;
};


/** Lock fixtures, shaped the way the locker page reads them. */
export const MOCK_LOCKS = [
  {
    id: 0,
    token: "0x55d398326f99059fF775485246999027B3197955",
    owner: "0x1d1479C185d32EB90533a08b36B3CFa5F84A0E6B",
    name: "Meta Inu",
    symbol: "MENU",
    decimals: 9,
    amount: "250000000000000",
    lockDate: base - 6 * DAY,
    unlockDate: base + 180 * DAY,
    isLp: false,
    label: "Team allocation (6 months)",
  },
  {
    id: 1,
    token: "0x7EFaEf62fDdCCa950418312c6C91Aef321375A00",
    owner: "0x1d1479C185d32EB90533a08b36B3CFa5F84A0E6B",
    name: "MENU/BNB",
    symbol: "MENU/BNB",
    decimals: 18,
    amount: "42000000000000000000",
    lockDate: base - 6 * DAY,
    unlockDate: base + 365 * DAY,
    isLp: true,
    label: "Listing liquidity (12 months)",
  },
  {
    id: 2,
    token: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    owner: "0x8aF0C4dE4dE5b7A1eBa53e6A0f7Cc1F3B2A9d0e4",
    name: "Tokyo Millions",
    symbol: "TOMI",
    decimals: 18,
    amount: "1000000000000000000000000",
    lockDate: base - 20 * DAY,
    unlockDate: base - 1 * DAY,
    isLp: false,
    label: "Advisor tranche (unlocked)",
  },
];

/** Locks held by one address, newest first. */
export const listMockLocks = (owner) => {
  if (!owner) return MOCK_LOCKS;
  return MOCK_LOCKS.filter(
    (lock) => lock.owner.toLowerCase() === String(owner).toLowerCase()
  );
};

/** Split locks into the two tabs the locker page renders. */
export const partitionMockLocks = (locks = MOCK_LOCKS) => ({
  token: locks.filter((lock) => !lock.isLp),
  liquidity: locks.filter((lock) => lock.isLp),
});

/** Whether a lock has passed its unlock date. */
export const isMockLockReleasable = (lock) =>
  Number(lock.unlockDate) <= Date.now() && Number(lock.amount) > 0;

export default MOCK_LAUNCHPADS;
