import walletConnect from "../services/walletConnect"

/**
 * Wallet connection.
 *
 * Driven against a fake `window.ethereum` rather than a real extension, so
 * the request/response contract the app depends on is pinned down: which RPC
 * methods it calls, and what it does when the user rejects the prompt.
 */

const ACCOUNT = "0x1d1479C185d32EB90533a08b36B3CFa5F84A0E6B"

/** Install a fake injected wallet and record the calls made to it. */
const installWallet = (overrides: any = {}) => {
	const calls: string[] = []
	const ethereum = {
		request: jest.fn(async ({ method }: any) => {
			calls.push(method)
			if (overrides[method]) return overrides[method]()
			switch (method) {
				case "eth_requestAccounts":
				case "eth_accounts":
					return [ACCOUNT]
				case "eth_chainId":
					return "0x61"
				default:
					return null
			}
		}),
		on: jest.fn(),
		removeListener: jest.fn(),
	}
	;(window as any).ethereum = ethereum
	return { ethereum, calls }
}

afterEach(() => {
	delete (window as any).ethereum
	walletConnect.disconnect()
	jest.resetModules()
})

describe("hasInjectedWallet", () => {
	it("is false with no extension present", () => {
		expect(walletConnect.hasInjectedWallet()).toBe(false)
	})

	it("is true once a wallet injects itself", () => {
		installWallet()
		expect(walletConnect.hasInjectedWallet()).toBe(true)
	})
})

describe("connect", () => {
	it("throws when there is no wallet to connect to", async () => {
		await expect(walletConnect.connect()).rejects.toThrow(
			"No wallet extension detected"
		)
	})

	it("asks the wallet for accounts", async () => {
		const { calls } = installWallet()

		await walletConnect.connect().catch(() => undefined)

		expect(calls).toContain("eth_requestAccounts")
	})

	it("surfaces a rejected prompt as an error", async () => {
		installWallet({
			eth_requestAccounts: () => {
				throw Object.assign(new Error("User rejected"), { code: 4001 })
			},
		})

		await expect(walletConnect.connect()).rejects.toThrow("User rejected")
	})
})

describe("subscribe", () => {
	it("returns an unsubscribe function", () => {
		const unsubscribe = walletConnect.subscribe(() => undefined)
		expect(typeof unsubscribe).toBe("function")
		unsubscribe()
	})

	it("notifies subscribers on disconnect", () => {
		const listener = jest.fn()
		const unsubscribe = walletConnect.subscribe(listener)

		walletConnect.disconnect()

		expect(listener).toHaveBeenCalled()
		unsubscribe()
	})
})

describe("getAccount", () => {
	it("is null before connecting", () => {
		expect(walletConnect.getAccount()).toBeNull()
	})
})
