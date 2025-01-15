import React, { useEffect, useState } from "react"
import styled from "styled-components"

import { getPrice, formatUsd } from "../../../services/priceService"

/**
 * Live native-coin price in the toolbar.
 *
 * Renders nothing at all when no quote is available - an empty slot is
 * better than a placeholder that looks like a real number.
 */

const Wrapper = styled.div`
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
	color: ${({ theme }) => theme.text};
`

const Symbol = styled.span`
	font-weight: 600;
	opacity: 0.8;
`

const Change = styled.span<{ up: boolean }>`
	color: ${({ up, theme }) => (up ? theme.green : theme.warn)};
`

interface Props {
	symbol?: string
	refreshMs?: number
}

const PriceTicker: React.FC<Props> = ({ symbol = "bnb", refreshMs = 60000 }) => {
	const [price, setPrice] = useState<number | null>(null)
	const [previous, setPrevious] = useState<number | null>(null)

	useEffect(() => {
		let cancelled = false

		const tick = async () => {
			const next = await getPrice(symbol)
			if (cancelled || next === null) return
			setPrice((current) => {
				setPrevious(current)
				return next
			})
		}

		tick()
		const timer = setInterval(tick, refreshMs)

		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [symbol, refreshMs])

	if (price === null) return null

	const up = previous !== null && price >= previous

	return (
		<Wrapper title={`${symbol.toUpperCase()} spot price`}>
			<Symbol>{symbol.toUpperCase()}</Symbol>
			<span>{formatUsd(price)}</span>
			{previous !== null && previous !== price && (
				<Change up={up}>{up ? "▲" : "▼"}</Change>
			)}
		</Wrapper>
	)
}

export default PriceTicker
