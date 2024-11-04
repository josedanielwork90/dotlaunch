/**
 * Build-time constants.
 *
 * Endpoints and contract addresses come from `process.env.REACT_APP_*`,
 * which Create React App inlines at build time. That means one build per
 * environment, which is fine while there is only a testnet deployment.
 */

export const API_ENDPOINT =
  process.env.REACT_APP_ENDPOINT || "http://localhost:8888/api/v1";

export const RPC_URL_BSC =
  process.env.REACT_APP_BSC_RPC_URL ||
  "https://data-seed-prebsc-1-s1.binance.org:8545/";

export const BSC_CONTRACT_ADDRESS = {
  DEPLOYER: process.env.REACT_APP_BSC_CONTRACT_ADDR_DEPLOYER || "",
  TOKEN_LOCK: process.env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_LOCK || "",
  TOKEN_MANAGE: process.env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_MANAGE || "",
  TOKEN_MULTISEND: process.env.REACT_APP_BSC_CONTRACT_ADDR_MULTISEND || "",
};

export const CHAIN_SUPPORT = {
  bsc: "bsc",
};

export const CHAIN_INFO = {
  [CHAIN_SUPPORT.bsc]: {
    chainId: {
      mainnet: 56,
      testnet: 97,
    },
    baseNetworkUrl: {
      mainnet: "https://bscscan.com",
      testnet: "https://testnet.bscscan.com",
    },
    baseRpcNodeUrl: {
      mainnet: "https://bsc-dataseed.binance.org/",
      testnet: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    },
  },
};

export const LIST_SALE_STATUS = [
  { value: 0, label: "Upcoming", color: "secondary" },
  { value: 1, label: "Success", color: "green" },
  { value: 2, label: "Cancelled", color: "warn" },
  { value: 3, label: "Active", color: "primary" },
  { value: 4, label: "Ended", color: "secondary" },
  { value: 5, label: "Failed", color: "warn" },
];

export const ListStatus = [
  { value: 0, label: "" },
  { value: 1, label: "Finished" },
  { value: 2, label: "Cancelled" },
];

export const STT_OK = 200;
export const STT_BAD_REQUEST = 400;
export const STT_UNAUTHORIZED = 401;
export const STT_FORBIDDEN = 403;
export const STT_NOT_FOUND = 404;
export const STT_INTERNAL_SERVER = 500;
export const STT_BAD_GATEWAY = 502;

export const DEFAULT_PAGE_SIZE = 6;

export const EXPLORER_BASE_URL =
  process.env.REACT_APP_EXPLORER_URL || "https://testnet.bscscan.com";
