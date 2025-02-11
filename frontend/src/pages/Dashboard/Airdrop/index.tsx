import React, { useMemo, useState } from "react"
import styled from "styled-components"

import Card from "../../../components/common/Card"
import Button from "../../../components/common/Button"
import Badge from "../../../components/common/Badge"
import NoData from "../../../components/layout/NoData"
import { shortenAddress } from "../../../utils"

/**
 * Airdrop campaigns.
 *
 * A project uploads a recipient list, funds the campaign, and claimants pull
 * their allocation themselves rather than the project paying for every
 * transfer. This is the campaign overview; creation lives in ./Create.
 */

const Header = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 1.5rem;
`

const Title = styled.h1`
	font-size: 1.5rem;
	font-weight: 600;
	color: ${({ theme }) => theme.text};
`

const Grid = styled.div`
	display: grid;
	gap: 1rem;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
`

const Row = styled.div`
	display: flex;
	justify-content: space-between;
	padding: 0.35rem 0;
	font-size: 0.875rem;
`

const Label = styled.span`
	opacity: 0.7;
`

export interface AirdropCampaign {
	id: string
	name: string
	token: string
	symbol: string
	totalAllocation: string
	recipients: number
	claimed: number
	status: "draft" | "funded" | "live" | "complete"
}

const STATUS_COLOR: Record<AirdropCampaign["status"], string> = {
	draft: "secondary",
	funded: "primary",
	live: "green",
	complete: "secondary",
}

interface Props {
	campaigns?: AirdropCampaign[]
	onCreate?: () => void
}

const AirdropList: React.FC<Props> = ({ campaigns = [], onCreate }) => {
	const [filter, setFilter] = useState<string>("all")

	const visible = useMemo(() => {
		if (filter === "all") return campaigns
		return campaigns.filter((campaign) => campaign.status === filter)
	}, [campaigns, filter])

	const progress = (campaign: AirdropCampaign) =>
		campaign.recipients === 0
			? 0
			: Math.round((campaign.claimed / campaign.recipients) * 100)

	return (
		<div>
			<Header>
				<Title>Airdrops</Title>
				<Button onClick={onCreate}>New campaign</Button>
			</Header>

			<div className="flex gap-2 mb-4">
				{["all", "draft", "funded", "live", "complete"].map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => setFilter(option)}
						className={filter === option ? "font-semibold underline" : ""}
					>
						{option}
					</button>
				))}
			</div>

			{visible.length === 0 ? (
				<NoData />
			) : (
				<Grid>
					{visible.map((campaign) => (
						<Card key={campaign.id}>
							<Row>
								<strong>{campaign.name}</strong>
								<Badge color={STATUS_COLOR[campaign.status]}>
									{campaign.status}
								</Badge>
							</Row>
							<Row>
								<Label>Token</Label>
								<span>{shortenAddress(campaign.token)}</span>
							</Row>
							<Row>
								<Label>Allocation</Label>
								<span>
									{campaign.totalAllocation} {campaign.symbol}
								</span>
							</Row>
							<Row>
								<Label>Recipients</Label>
								<span>{campaign.recipients}</span>
							</Row>
							<Row>
								<Label>Claimed</Label>
								<span>{progress(campaign)}%</span>
							</Row>
						</Card>
					))}
				</Grid>
			)}
		</div>
	)
}

export default AirdropList
