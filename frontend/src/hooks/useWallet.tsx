import { useCallback, useEffect, useState } from "react"

import walletConnect from "../services/walletConnect"

/**
 * Connected-wallet state as a hook.
 *
 * Wraps the module-scoped connection in `services/walletConnect` so a
 * component re-renders when the account or chain changes, instead of reading
 * a value that silently goes stale.
 */

interface WalletState {
	account: string | null
	chainId: number | null
	connecting: boolean
	error: string | null
}

const initialState: WalletState = {
	account: null,
	chainId: null,
	connecting: false,
	error: null,
}

export const useWallet = () => {
	const [state, setState] = useState<WalletState>(initialState)

	useEffect(() => {
		const unsubscribe = walletConnect.subscribe(({ account, chainId }: any) => {
			setState((previous) => ({ ...previous, account, chainId }))
		})

		// Restore a connection the wallet has already approved, so a refresh
		// does not look like a sign-out.
		walletConnect.reconnect().catch(() => undefined)

		return unsubscribe
	}, [])

	const connect = useCallback(async () => {
		setState((previous) => ({ ...previous, connecting: true, error: null }))
		try {
			const { account, chainId } = await walletConnect.connect()
			setState({ account, chainId, connecting: false, error: null })
		} catch (error: any) {
			setState((previous) => ({
				...previous,
				connecting: false,
				error: error.message || "Could not connect",
			}))
		}
	}, [])

	const disconnect = useCallback(() => {
		walletConnect.disconnect()
		setState(initialState)
	}, [])

	const switchChain = useCallback(async () => {
		const ok = await walletConnect.switchToSupportedChain()
		if (!ok) {
			setState((previous) => ({
				...previous,
				error: "Could not switch network",
			}))
		}
		return ok
	}, [])

	return {
		...state,
		isConnected: state.account !== null,
		hasWallet: walletConnect.hasInjectedWallet(),
		onSupportedChain: walletConnect.isOnSupportedChain(),
		connect,
		disconnect,
		switchChain,
	}
}

export default useWallet
