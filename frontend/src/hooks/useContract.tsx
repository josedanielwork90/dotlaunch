import { useMemo } from "react"
import { Contract } from "ethers"

import walletConnect from "../services/walletConnect"

/**
 * A contract instance bound to the connected wallet.
 *
 * Returns a read-only instance when nothing is connected, so views that only
 * display chain state keep working for a visitor without a wallet, and only
 * the write paths need a connection check.
 */
export const useContract = (address?: string, abi?: any) => {
	return useMemo(() => {
		if (!address || !abi) return null

		const provider = walletConnect.getProvider()
		if (provider === null) return null

		const signer = walletConnect.getSigner()
		return new Contract(address, abi, signer || provider)
	}, [address, abi])
}

/** True when the contract can send transactions, not just read. */
export const useCanWrite = () => walletConnect.getSigner() !== null

export default useContract
