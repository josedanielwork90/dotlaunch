import React, { useEffect, useMemo, useState } from "react"
import styled from "styled-components"

import Card from "../../../components/common/Card"
import Badge from "../../../components/common/Badge"
import NoData from "../../../components/layout/NoData"
import { getUserContributions } from "../../../services/blockchainService"
import { shortenAddress, getTokenNumberFromBN } from "../../../utils"

/**
 * What this wallet is holding across the platform.
 *
 * Contributions, claimable allocations and locks in one place, so a
 * participant does not have to remember which presales they entered. Every
 * figure is read from the chain rather than the index: the index can lag a
 * block or two, and being wrong about someone's own money is unforgivable.
 */

const Grid = styled.div`
	display: grid;
	gap: 1rem;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	margin-bottom: 2rem;
`

const Summary = styled.div`
	display: flex;
	gap: 2rem;
	padding: 1rem 0 1.5rem;
`

const Figure = styled.div`
	display: flex;
	flex-direction: column;
`

const FigureValue = styled.span`
	font-size: 1.375rem;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
`

const FigureLabel = styled.span`
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	opacity: 0.65;
`

const Row = styled.div`
	display: flex;
	justify-content: space-between;
	padding: 0.3rem 0;
	font-size: 0.875rem;
`

interface Position {
	launchpad: string
	name: string
	symbol: string
	decimals: number
	deposited: string
	earned: string
	claimed: boolean
	status: number
}

const Portfolio: React.FC = () => {
	const [positions, setPositions] = useState<Position[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false

		const load = async () => {
			try {
				const result = await getUserContributions()
				if (!cancelled) setPositions(result || [])
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		load()
		return () => {
			cancelled = true
		}
	}, [])

	const totals = useMemo(() => {
		const contributed = positions.reduce(
			(sum, position) => sum + Number(position.deposited),
			0
		)
		const claimable = positions.filter(
			(position) => !position.claimed && position.status === 1
		).length

		return { contributed, claimable, count: positions.length }
	}, [positions])

	if (loading) return <p>Loading your positions…</p>
	if (positions.length === 0) return <NoData />

	return (
		<div>
			<Summary>
				<Figure>
					<FigureValue>{totals.count}</FigureValue>
					<FigureLabel>Presales entered</FigureLabel>
				</Figure>
				<Figure>
					<FigureValue>{totals.contributed.toFixed(4)}</FigureValue>
					<FigureLabel>Total contributed</FigureLabel>
				</Figure>
				<Figure>
					<FigureValue>{totals.claimable}</FigureValue>
					<FigureLabel>Ready to claim</FigureLabel>
				</Figure>
			</Summary>

			<Grid>
				{positions.map((position) => (
					<Card key={position.launchpad}>
						<Row>
							<strong>{position.name || "Unnamed"}</strong>
							<Badge color={position.claimed ? "secondary" : "primary"}>
								{position.claimed ? "Claimed" : "Open"}
							</Badge>
						</Row>
						<Row>
							<span>Presale</span>
							<span>{shortenAddress(position.launchpad)}</span>
						</Row>
						<Row>
							<span>Contributed</span>
							<span>{position.deposited}</span>
						</Row>
						<Row>
							<span>Allocation</span>
							<span>
								{getTokenNumberFromBN(position.earned as any, position.decimals)}{" "}
								{position.symbol}
							</span>
						</Row>
					</Card>
				))}
			</Grid>
		</div>
	)
}

export default Portfolio
