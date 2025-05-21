/**
 * Runtime configuration.
 *
 * A Create React App bundle normally freezes `process.env.REACT_APP_*` at
 * build time, which makes one image per environment. Instead the container
 * writes `public/config.js` on startup and this module reads it, so the same
 * built bundle can point at a local anvil node, a testnet or production.
 *
 * Resolution order for every value:
 *   1. `window.__DOTLAUNCH_CONFIG__` (injected at container start)
 *   2. `process.env.REACT_APP_*`     (dev server / CI)
 *   3. a local-development default
 *
 * Everything in the app that needs an endpoint, a contract address or a
 * feature flag goes through here — there are no scattered `process.env`
 * reads, which is what makes the deployment story auditable in one file.
 */

export interface ContractAddresses {
  /** LaunchpadDeployer — creates and indexes presales. */
  deployer: string;
  /** SenseiLock — token and liquidity locks. */
  tokenLock: string;
  /** ManageToken — the token factory. */
  tokenManage: string;
  /** BulkTransfer — multisend / airdrop distribution. */
  tokenMultisend: string;
}

export interface RuntimeConfig {
  /** Base URL of the DotLaunch API, including the version prefix. */
  apiBaseUrl: string;
  /** JSON-RPC endpoint the browser talks to. */
  chainRpcUrl: string;
  /** EIP-155 chain id the app expects to be connected to. */
  chainId: number;
  /** Human-readable chain label shown in the network selector. */
  chainName: string;
  /** Block explorer root, used to build transaction and address links. */
  explorerUrl: string;
  /** Native currency symbol for the active chain. */
  nativeSymbol: string;
  /** Base URL that uploaded metadata is served from. */
  storageBaseUrl: string;
  contracts: ContractAddresses;
  /**
   * Demo mode exposes the local chain's unlocked accounts as selectable
   * wallets, so the app is usable without a browser extension. It must never
   * be enabled against a live network.
   */
  demoMode: boolean;
  /**
   * When set, the app treats this ISO instant as "now" everywhere instead of
   * reading the system clock. Countdowns, relative timestamps and
   * time-derived sale states all become reproducible, which is what makes
   * screenshots and time-sensitive tests deterministic.
   */
  fixedNow: string | null;
}

/** Shape of the object `public/config.js` assigns onto `window`. */
export interface InjectedConfig extends Partial<Omit<RuntimeConfig, "contracts">> {
  contracts?: Partial<ContractAddresses>;
}

/**
 * Read the injected config off a global scope object.
 *
 * Takes `any` rather than casting `window`. This project builds on
 * react-scripts 4, whose Babel pipeline does not accept TypeScript-only
 * syntax such as `x as T` or `declare global` — which is why there is not a
 * single type assertion anywhere in this codebase. An `any` parameter is
 * accepted by the toolchain and keeps the untyped access confined to one
 * function, with a typed return for every caller.
 */
const readInjected = (scope: any): InjectedConfig => {
  if (!scope || !scope.__DOTLAUNCH_CONFIG__) return {};
  return scope.__DOTLAUNCH_CONFIG__;
};

const injected = (): InjectedConfig => {
  if (typeof window === "undefined") return {};
  return readInjected(window);
};

/** First non-empty value among the candidates, else the fallback. */
const pick = (...candidates: Array<string | undefined | null>): string => {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return candidate;
    }
  }
  return "";
};

const toNumber = (value: string | number | undefined, fallback: number): number => {
  if (value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBoolean = (value: boolean | string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const buildConfig = (): RuntimeConfig => {
  const runtime = injected();
  const env = process.env;

  return {
    apiBaseUrl: pick(
      runtime.apiBaseUrl,
      env.REACT_APP_ENDPOINT,
      "http://localhost:8888/api/v1"
    ),
    chainRpcUrl: pick(
      runtime.chainRpcUrl,
      env.REACT_APP_CHAIN_RPC_URL,
      env.REACT_APP_BSC_RPC_URL,
      "http://localhost:8545"
    ),
    chainId: toNumber(
      runtime.chainId !== undefined ? runtime.chainId : env.REACT_APP_CHAIN_ID,
      31337
    ),
    chainName: pick(runtime.chainName, env.REACT_APP_CHAIN_NAME, "Localhost"),
    explorerUrl: pick(
      runtime.explorerUrl,
      env.REACT_APP_EXPLORER_URL,
      "http://localhost:8545"
    ),
    nativeSymbol: pick(
      runtime.nativeSymbol,
      env.REACT_APP_NATIVE_SYMBOL,
      "ETH"
    ),
    storageBaseUrl: pick(
      runtime.storageBaseUrl,
      env.REACT_APP_STORAGE_BASE_URL,
      "http://localhost:8888/api/v1/storage"
    ),
    contracts: {
      deployer: pick(
        runtime.contracts?.deployer,
        env.REACT_APP_CONTRACT_DEPLOYER,
        env.REACT_APP_BSC_CONTRACT_ADDR_DEPLOYER
      ),
      tokenLock: pick(
        runtime.contracts?.tokenLock,
        env.REACT_APP_CONTRACT_TOKEN_LOCK,
        env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_LOCK
      ),
      tokenManage: pick(
        runtime.contracts?.tokenManage,
        env.REACT_APP_CONTRACT_TOKEN_MANAGE,
        env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_MANAGE
      ),
      tokenMultisend: pick(
        runtime.contracts?.tokenMultisend,
        env.REACT_APP_CONTRACT_MULTISEND,
        env.REACT_APP_BSC_CONTRACT_ADDR_MULTISEND
      ),
    },
    demoMode: toBoolean(
      runtime.demoMode !== undefined ? runtime.demoMode : env.REACT_APP_DEMO_MODE,
      false
    ),
    fixedNow: pick(runtime.fixedNow, env.REACT_APP_FIXED_NOW) || null,
  };
};

/**
 * The resolved configuration.
 *
 * Built once on first import: `config.js` is a synchronous script tag in
 * `index.html`, so it has always executed by the time any module here runs.
 */
export const runtimeConfig: RuntimeConfig = buildConfig();

/**
 * Recompute the configuration from the current environment.
 *
 * Updates the shared `runtimeConfig` object in place rather than returning a
 * detached copy. Everything else in the app - including `now()` below - holds
 * a reference to that object, so returning a new one would leave every
 * existing reader on the old values and make this function silently useless.
 *
 * Only needed by tests, which vary `window.__DOTLAUNCH_CONFIG__` between
 * cases; application code should read `runtimeConfig` directly.
 */
export const reloadRuntimeConfig = (): RuntimeConfig => {
  const next = buildConfig();
  Object.assign(runtimeConfig, next);
  return runtimeConfig;
};

/**
 * The application's clock.
 *
 * Every relative time in the UI — countdowns, "starts in", sale state
 * derivation — must read from here rather than calling `Date.now()`, so that
 * setting `fixedNow` freezes the whole interface at a known instant.
 */
export const now = (): number => {
  const { fixedNow } = runtimeConfig;
  if (!fixedNow) return Date.now();

  const parsed = Date.parse(fixedNow);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

/** True when the app is pinned to a fixed instant rather than the system clock. */
export const isClockFrozen = (): boolean => {
  const { fixedNow } = runtimeConfig;
  if (!fixedNow) return false;
  return !Number.isNaN(Date.parse(fixedNow));
};

/** Explorer link for a transaction hash. */
export const explorerTxUrl = (hash: string): string =>
  `${runtimeConfig.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;

/** Explorer link for an address. */
export const explorerAddressUrl = (address: string): string =>
  `${runtimeConfig.explorerUrl.replace(/\/$/, "")}/address/${address}`;

export default runtimeConfig;
