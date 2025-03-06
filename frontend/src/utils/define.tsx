import { runtimeConfig } from "./runtimeConfig";

/**
 * Endpoints and addresses are resolved through `runtimeConfig` so a single
 * built bundle can be pointed at a local chain, a testnet or mainnet without
 * a rebuild. The names below are kept for backwards compatibility with the
 * modules that already import them.
 */
export const RPC_URL_BSC = runtimeConfig.chainRpcUrl;

export const BSC_CONTRACT_ADDRESS = {
  DEPLOYER: runtimeConfig.contracts.deployer,
  TOKEN_LOCK: runtimeConfig.contracts.tokenLock,
  TOKEN_MANAGE: runtimeConfig.contracts.tokenManage,
  TOKEN_MULTISEND: runtimeConfig.contracts.tokenMultisend,
};

export const CHAIN_SUPPORT = {
  bsc: "bsc",
  local: "local",
};

export const CHAIN_INFO = {
  [CHAIN_SUPPORT.local]: {
    chainId: {
      mainnet: 31337,
      testnet: 31337,
    },
    baseNetworkUrl: {
      mainnet: runtimeConfig.explorerUrl,
      testnet: runtimeConfig.explorerUrl,
    },
    baseRpcNodeUrl: {
      mainnet: runtimeConfig.chainRpcUrl,
      testnet: runtimeConfig.chainRpcUrl,
    },
  },
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

enum COLOR_ENUM {
  GREEN = "green",
  PRIMARY = "primary",
  SECONDARY = "secondary",
  WARN = "warn",
}

export const LIST_SALE_STATUS = [
  {
    value: 0,
    label: "Upcoming",
    color: COLOR_ENUM.SECONDARY,
  },
  {
    value: 1,
    label: "Success",
    color: COLOR_ENUM.GREEN,
  },
  {
    value: 2,
    label: "Cancelled",
    color: COLOR_ENUM.WARN,
  },
  {
    value: 3,
    label: "Active",
    color: COLOR_ENUM.PRIMARY,
  },
  {
    value: 4,
    label: "Ended",
    color: COLOR_ENUM.SECONDARY,
  },
  {
    value: 5,
    label: "Failed",
    color: COLOR_ENUM.WARN,
  },
];

export const ListStatus = [
  {
    value: 0,
    label: "",
  },
  {
    value: 1,
    label: "Finished",
  },
  {
    value: 2,
    label: "Cancelled",
  },
];

export const STT_OK = 200;
export const STT_BAD_REQUEST = 400;
export const STT_UNAUTHORIZED = 401;
export const STT_FORBIDDEN = 403;
export const STT_NOT_FOUND = 404;
export const STT_INTERNAL_SERVER = 500;
export const STT_BAD_GATEWAY = 502;
