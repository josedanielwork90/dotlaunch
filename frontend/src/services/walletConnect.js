import { ethers } from "ethers"

import { CHAIN_INFO, CHAIN_SUPPORT } from "../constants"

/**
 * Browser wallet connection.
 *
 * Talks to whatever injects `window.ethereum` — MetaMask, Trust, Binance
 * Wallet — and keeps the connected account and chain in module scope so any
 * component can read them without threading a provider through props.
 */

let provider = null
let signer = null
let account = null
let chainId = null

const listeners = new Set()

const notify = () => {
	for (const listener of listeners) {
		listener({ account, chainId })
	}
}

/** Subscribe to account and chain changes. Returns an unsubscribe function. */
export const subscribe = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** Whether an injected wallet is present at all. */
export const hasInjectedWallet = () =>
	typeof window !== "undefined" && Boolean(window.ethereum)

/** The ethers provider, built on first use. */
export const getProvider = () => {
	if (!hasInjectedWallet()) return null
	if (provider === null) {
		provider = new ethers.providers.Web3Provider(window.ethereum, "any")
	}
	return provider
}

/** The signer for the connected account, or null when not connected. */
export const getSigner = () => signer

/** The connected account address, or null. */
export const getAccount = () => account

/**
 * Prompt the wallet for access and record the resulting account.
 *
 * Throws when no wallet is installed, so the caller can show the install
 * prompt rather than silently doing nothing.
 */
export const connect = async () => {
	if (!hasInjectedWallet()) {
		throw new Error("No wallet extension detected")
	}

	const web3Provider = getProvider()
	const accounts = await window.ethereum.request({
		method: "eth_requestAccounts",
	})

	account = accounts[0] || null
	signer = account ? web3Provider.getSigner() : null

	const network = await web3Provider.getNetwork()
	chainId = network.chainId

	attachHandlers()
	notify()

	return { account, chainId }
}

/** Forget the connection locally. The wallet keeps its own permission. */
export const disconnect = () => {
	account = null
	signer = null
	notify()
}

/** Re-establish a connection the wallet has already granted, without a prompt. */
export const reconnect = async () => {
	if (!hasInjectedWallet()) return null

	const accounts = await window.ethereum.request({ method: "eth_accounts" })
	if (accounts.length === 0) return null

	return connect()
}

let handlersAttached = false

const attachHandlers = () => {
	if (handlersAttached || !hasInjectedWallet()) return

	window.ethereum.on("accountsChanged", (accounts) => {
		account = accounts[0] || null
		signer = account ? getProvider().getSigner() : null
		notify()
	})

	window.ethereum.on("chainChanged", (nextChainId) => {
		chainId = Number.parseInt(nextChainId, 16)
		provider = null
		signer = null
		notify()
	})

	handlersAttached = true
}

/** Ask the wallet to switch to the chain the app expects. */
export const switchToSupportedChain = async (network = "testnet") => {
	if (!hasInjectedWallet()) return false

	const expected = CHAIN_INFO[CHAIN_SUPPORT.bsc].chainId[network]
	const hexChainId = ethers.utils.hexValue(expected)

	try {
		await window.ethereum.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: hexChainId }],
		})
		return true
	} catch (error) {
		if (error.code === 4902) {
			return addChain(network)
		}
		return false
	}
}

/** Add the chain to the wallet when it does not know about it yet. */
const addChain = async (network) => {
	const info = CHAIN_INFO[CHAIN_SUPPORT.bsc]

	try {
		await window.ethereum.request({
			method: "wallet_addEthereumChain",
			params: [
				{
					chainId: ethers.utils.hexValue(info.chainId[network]),
					chainName: network === "mainnet" ? "BSC Mainnet" : "BSC Testnet",
					nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
					rpcUrls: [info.baseRpcNodeUrl[network]],
					blockExplorerUrls: [info.baseNetworkUrl[network]],
				},
			],
		})
		return true
	} catch (error) {
		return false
	}
}

/** Whether the wallet is on a chain the app supports. */
export const isOnSupportedChain = (network = "testnet") =>
	chainId === CHAIN_INFO[CHAIN_SUPPORT.bsc].chainId[network]

export default {
	connect,
	disconnect,
	reconnect,
	subscribe,
	getProvider,
	getSigner,
	getAccount,
	hasInjectedWallet,
	switchToSupportedChain,
	isOnSupportedChain,
}
