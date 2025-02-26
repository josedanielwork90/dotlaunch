import { runtimeConfig } from "../../utils/runtimeConfig";
import DemoWalletProvider, { DemoAccount } from "./DemoWalletProvider";
import { isUnrecognisedChain } from "../../utils/errors";

/**
 * Wallet access, behind one interface.
 *
 * The app supports three ways to hold an account - an injected extension,
 * WalletConnect, and the built-in demo wallet - and the rest of the codebase
 * should not care which is active. Everything goes through `walletManager`,
 * which exposes the current provider and address and nothing else.
 *
 * Consolidating this also fixes a class of bug the previous code had: it
 * reached for `window.ethereum` at call sites scattered across the service
 * layer, so any browser without an extension threw a bare ReferenceError
 * rather than showing the user something useful.
 */

export const WALLET_TYPE = Object.freeze({
  INJECTED: "INJECTED",
  WALLET_CONNECT: "WALLET_CONNECT",
  DEMO: "DEMO",
});

export type WalletType = "INJECTED" | "WALLET_CONNECT" | "DEMO";

/** Where the active wallet kind is remembered across reloads. */
const STORAGE_KEY = "dotLaunch_walletType";
const ADDRESS_KEY = "dotLaunch_userAddress";

const readStorage = (key: string): string => {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch (error) {
    // Storage may be unavailable; the session simply does not persist.
  }
};

/** The injected provider, or null when no extension is installed. */
const injectedProvider = (): any => {
  if (typeof window === "undefined") return null;
  const scope: any = window;
  return scope.ethereum || null;
};

export interface WalletOption {
  type: WalletType;
  label: string;
  description: string;
  available: boolean;
  /** Why it is unavailable, shown to the user instead of a dead button. */
  unavailableReason?: string;
}

class WalletManager {
  provider: any = null;

  type: WalletType | "" = "";

  address = "";

  demo: DemoWalletProvider | null = null;

  listeners: Array<(address: string) => void> = [];

  /** The demo provider, created on first use. */
  demoProvider(): DemoWalletProvider {
    if (!this.demo) this.demo = new DemoWalletProvider();
    return this.demo;
  }

  /**
   * Wallets offered in the connect dialog.
   *
   * Unavailable options are returned too, with a reason, so the UI can
   * explain why a choice is greyed out rather than silently omitting it.
   */
  options(): WalletOption[] {
    const injected = injectedProvider();
    const list: WalletOption[] = [];

    if (DemoWalletProvider.isAvailable()) {
      list.push({
        type: "DEMO",
        label: "Demo wallet",
        description:
          "Use a pre-funded account on the local chain. No extension needed.",
        available: true,
      });
    }

    list.push({
      type: "INJECTED",
      label: "MetaMask",
      description: "Connect the wallet extension installed in this browser.",
      available: Boolean(injected),
      unavailableReason: injected ? undefined : "No wallet extension detected",
    });

    list.push({
      type: "WALLET_CONNECT",
      label: "WalletConnect",
      description: "Scan a QR code with a mobile wallet.",
      // WalletConnect reaches its relay over the internet, so it cannot work
      // in the offline demo environment.
      available: !runtimeConfig.demoMode,
      unavailableReason: runtimeConfig.demoMode
        ? "Needs internet access; unavailable in demo mode"
        : undefined,
    });

    return list;
  }

  /** Demo accounts, for the account picker. Empty for other wallet types. */
  async demoAccounts(): Promise<DemoAccount[]> {
    if (!DemoWalletProvider.isAvailable()) return [];
    return this.demoProvider().loadAccounts();
  }

  /**
   * Connect a wallet and return the active address.
   *
   * @param type Which wallet to use.
   * @param options.address Specific demo account to select.
   * @param options.provider An externally created WalletConnect provider.
   */
  async connect(
    type: WalletType,
    options: { address?: string; provider?: any } = {}
  ): Promise<string> {
    if (type === "DEMO") {
      const demo = this.demoProvider();
      const address = await demo.connect(options.address);
      this.setActive("DEMO", demo, address);
      return address;
    }

    if (type === "WALLET_CONNECT") {
      if (!options.provider) {
        throw new Error("WalletConnect provider was not supplied.");
      }
      const accounts = await options.provider.request({
        method: "eth_requestAccounts",
      });
      this.setActive("WALLET_CONNECT", options.provider, accounts[0] || "");
      return this.address;
    }

    const injected = injectedProvider();
    if (!injected) {
      throw new Error(
        "No wallet extension detected. Use the demo wallet, or install MetaMask."
      );
    }

    const accounts = await injected.request({ method: "eth_requestAccounts" });
    await this.ensureChain(injected);
    this.setActive("INJECTED", injected, accounts[0] || "");
    return this.address;
  }

  /**
   * Ask an injected wallet to switch to the configured chain.
   *
   * The chain is read from configuration rather than hardcoded. The previous
   * implementation always demanded BSC testnet (0x61), which meant the app
   * could never be used against any other network - including the local one
   * it now ships with.
   */
  async ensureChain(provider: any): Promise<void> {
    const target = `0x${runtimeConfig.chainId.toString(16)}`;
    const current = await provider.request({ method: "eth_chainId" });
    if (current === target) return;

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target }],
      });
    } catch (error) {
      // The wallet does not know this chain yet; offer to add it.
      if (isUnrecognisedChain(error)) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: target,
              chainName: runtimeConfig.chainName,
              rpcUrls: [runtimeConfig.chainRpcUrl],
              nativeCurrency: {
                name: runtimeConfig.nativeSymbol,
                symbol: runtimeConfig.nativeSymbol,
                decimals: 18,
              },
            },
          ],
        });
        return;
      }
      throw error;
    }
  }

  /** Switch to a different demo account without a full reconnect. */
  async switchDemoAccount(address: string): Promise<string> {
    if (this.type !== "DEMO") return this.connect("DEMO", { address });
    const next = await this.demoProvider().connect(address);
    this.address = next;
    writeStorage(ADDRESS_KEY, next);
    this.notify();
    return next;
  }

  /** Restore a previous session, or return "" if there is nothing to restore. */
  async restore(): Promise<string> {
    const type = readStorage(STORAGE_KEY);
    if (!type) return "";

    try {
      if (type === "DEMO" && DemoWalletProvider.isAvailable()) {
        return await this.connect("DEMO", { address: readStorage(ADDRESS_KEY) });
      }

      if (type === "INJECTED") {
        const injected = injectedProvider();
        if (!injected) return "";
        // eth_accounts does not prompt: it returns an already-granted
        // account, or nothing. Reconnecting silently on load must never
        // pop a wallet dialog the user did not ask for.
        const accounts = await injected.request({ method: "eth_accounts" });
        if (!accounts || accounts.length === 0) return "";
        this.setActive("INJECTED", injected, accounts[0]);
        return this.address;
      }
    } catch (error) {
      this.disconnect();
    }

    return "";
  }

  disconnect(): void {
    if (this.type === "DEMO" && this.demo) this.demo.disconnect();
    this.provider = null;
    this.type = "";
    this.address = "";
    writeStorage(STORAGE_KEY, "");
    writeStorage(ADDRESS_KEY, "");
    this.notify();
  }

  /** Subscribe to address changes. Returns an unsubscribe function. */
  subscribe(listener: (address: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  setActive(type: WalletType, provider: any, address: string): void {
    this.type = type;
    this.provider = provider;
    this.address = address;

    writeStorage(STORAGE_KEY, type);
    writeStorage(ADDRESS_KEY, address);

    if (provider && typeof provider.on === "function") {
      provider.on("accountsChanged", (accounts: string[]) => {
        this.address = accounts && accounts.length ? accounts[0] : "";
        writeStorage(ADDRESS_KEY, this.address);
        if (!this.address) this.disconnect();
        else this.notify();
      });
    }

    this.notify();
  }

  notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.address);
      } catch (error) {
        // One bad subscriber must not break the rest.
      }
    });
  }
}

/** Process-wide wallet manager. */
export const walletManager = new WalletManager();

export { DemoWalletProvider };
export type { DemoAccount };
export default walletManager;
