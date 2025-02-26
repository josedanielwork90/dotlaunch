import { runtimeConfig } from "../../utils/runtimeConfig";

/**
 * An EIP-1193 provider backed by the local development chain.
 *
 * The app is wallet-gated: without an injected wallet there is no way to
 * reach any screen. That makes it unusable for anyone evaluating it in a
 * container, on a fresh machine, or in a browser with no extension
 * installed - which is most people seeing it for the first time.
 *
 * This provider stands in for the extension. It speaks the same interface
 * the rest of the app already talks to (`request`, `on`, `removeListener`),
 * so nothing downstream needs to know which one it is holding.
 *
 * It holds no key material of any kind. A local development node keeps its
 * accounts unlocked and signs on their behalf, so `eth_sendTransaction` is
 * simply forwarded and the node does the signing. Nothing secret ever
 * reaches the browser, and this cannot be pointed at a real network: the
 * constructor refuses any chain id that is not a known local one.
 */

/** Chain ids a demo wallet is permitted to talk to. */
const LOCAL_CHAIN_IDS = [31337, 1337];

/** Where the selected demo account is remembered across reloads. */
const STORAGE_KEY = "dotLaunch_demoAccount";

type Listener = (payload: any) => void;

export interface DemoAccount {
  address: string;
  /** Display label, e.g. "Founder". */
  label: string;
  /** Longer description shown in the account picker. */
  description: string;
}

/**
 * Roles the seed script assigns to the first accounts of the development
 * mnemonic. Labelling them turns an opaque list of hex strings into
 * something a reviewer can navigate: "log in as the founder and you will see
 * the presales you created".
 */
const ACCOUNT_ROLES: Array<{ label: string; description: string }> = [
  { label: "Platform Admin", description: "Owns the deployer and token factory" },
  { label: "Founder", description: "Created Nova, Aurora, Zenith and Solaris" },
  { label: "Co-founder", description: "Created Helix, Quantum, Meridian and Cobalt" },
  { label: "Investor 1", description: "Contributed to several presales" },
  { label: "Investor 2", description: "Contributed to several presales" },
  { label: "Investor 3", description: "Contributed to several presales" },
  { label: "Investor 4", description: "Whitelisted for Quantum Vault" },
  { label: "Investor 5", description: "Contributed to several presales" },
  { label: "Investor 6", description: "Contributed to several presales" },
  { label: "Investor 7", description: "Contributed to several presales" },
  { label: "Investor 8", description: "Contributed to several presales" },
  { label: "Locker", description: "Holds the advisor token lock" },
];

const roleFor = (index: number) => {
  if (index < ACCOUNT_ROLES.length) return ACCOUNT_ROLES[index];
  return {
    label: `Account ${index}`,
    description: "Unused development account",
  };
};

/** Read a persisted selection, tolerating storage being unavailable. */
const readStoredAccount = (): string => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch (error) {
    return "";
  }
};

const writeStoredAccount = (address: string): void => {
  try {
    if (address) window.localStorage.setItem(STORAGE_KEY, address);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Private browsing or blocked storage: the selection simply does not
    // survive a reload, which is not worth failing a connection over.
  }
};

export class DemoWalletProvider {
  rpcUrl: string;

  chainId: number;

  /** Currently selected account, or "" when disconnected. */
  selected: string;

  /** All accounts the node has unlocked. */
  accounts: DemoAccount[];

  /**
   * Internal members. Not marked `private`: this project's Babel toolchain
   * does not parse TypeScript member modifiers (see utils/runtimeConfig).
   */
  listeners: Map<string, Listener[]>;

  requestId: number;

  constructor() {
    if (LOCAL_CHAIN_IDS.indexOf(runtimeConfig.chainId) === -1) {
      throw new Error(
        `The demo wallet only works against a local development chain. ` +
          `Configured chain id is ${runtimeConfig.chainId}.`
      );
    }

    this.rpcUrl = runtimeConfig.chainRpcUrl;
    this.chainId = runtimeConfig.chainId;
    this.selected = "";
    this.accounts = [];
    this.listeners = new Map();
    this.requestId = 0;
  }

  /** True when a demo wallet can be offered at all. */
  static isAvailable(): boolean {
    return (
      runtimeConfig.demoMode && LOCAL_CHAIN_IDS.indexOf(runtimeConfig.chainId) !== -1
    );
  }

  /** Raw JSON-RPC call against the configured node. */
  async send(method: string, params: any[]): Promise<any> {
    this.requestId += 1;

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.requestId,
        method,
        params: params || [],
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
    }

    const body = await response.json();
    if (body.error) {
      const error: any = new Error(body.error.message || `RPC ${method} failed`);
      error.code = body.error.code;
      error.data = body.error.data;
      throw error;
    }
    return body.result;
  }

  /** Load the node's unlocked accounts and attach role labels. */
  async loadAccounts(): Promise<DemoAccount[]> {
    const addresses: string[] = await this.send("eth_accounts", []);

    this.accounts = addresses.map((address, index) => ({
      address,
      ...roleFor(index),
    }));

    return this.accounts;
  }

  /**
   * Select an account, defaulting to the previously used one.
   *
   * Emits `accountsChanged` so anything listening reacts exactly as it
   * would to the user switching accounts in an extension.
   */
  async connect(address?: string): Promise<string> {
    if (this.accounts.length === 0) await this.loadAccounts();

    const known = (candidate: string) =>
      this.accounts.some(
        (account) => account.address.toLowerCase() === candidate.toLowerCase()
      );

    const stored = readStoredAccount();
    let next = "";

    if (address && known(address)) next = address;
    else if (stored && known(stored)) next = stored;
    else if (this.accounts.length > 0) next = this.accounts[1].address;

    if (!next) throw new Error("The development node exposed no accounts.");

    this.selected = next;
    writeStoredAccount(next);
    this.emit("accountsChanged", [next]);
    return next;
  }

  disconnect(): void {
    this.selected = "";
    writeStoredAccount("");
    this.emit("accountsChanged", []);
  }

  /**
   * EIP-1193 entry point.
   *
   * Account-scoped methods are answered locally from the current selection;
   * everything else is forwarded to the node untouched.
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    const { method } = args;
    const params = args.params || [];

    switch (method) {
      case "eth_requestAccounts": {
        const address = await this.connect();
        return [address];
      }

      case "eth_accounts":
        return this.selected ? [this.selected] : [];

      case "eth_chainId":
        return `0x${this.chainId.toString(16)}`;

      case "net_version":
        return String(this.chainId);

      // The demo wallet is bound to one chain, so a switch request to that
      // same chain succeeds and anything else is rejected the way an
      // extension would reject an unknown network.
      case "wallet_switchEthereumChain": {
        const target = params[0] && params[0].chainId;
        if (target && parseInt(target, 16) !== this.chainId) {
          const error: any = new Error(
            `The demo wallet is bound to chain ${this.chainId}.`
          );
          error.code = 4902;
          throw error;
        }
        return null;
      }

      case "wallet_addEthereumChain":
        return null;

      // Fill in the sender when the caller omitted it, then let the node
      // sign - it holds the keys for these accounts, the browser does not.
      case "eth_sendTransaction": {
        const tx = { ...(params[0] || {}) };
        if (!tx.from) tx.from = this.selected;
        return this.send("eth_sendTransaction", [tx]);
      }

      case "personal_sign":
      case "eth_sign":
      case "eth_signTypedData_v4":
        return this.send(method, params);

      default:
        return this.send(method, params);
    }
  }

  on(event: string, listener: Listener): void {
    const existing = this.listeners.get(event) || [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  removeListener(event: string, listener: Listener): void {
    const existing = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      existing.filter((candidate) => candidate !== listener)
    );
  }

  emit(event: string, payload: any): void {
    (this.listeners.get(event) || []).forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        // A misbehaving listener must not break the others.
      }
    });
  }
}

export default DemoWalletProvider;
