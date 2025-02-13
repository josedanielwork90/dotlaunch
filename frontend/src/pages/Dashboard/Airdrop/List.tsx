import React, { useMemo, useState } from "react"
import styled from "styled-components"

import Badge from "../../../components/common/Badge"
import Progress from "../../../components/common/Progress"
import Pagination from "../../../components/common/Pagination"
import { shortenAddress } from "../../../utils"

/**
 * Recipients of one airdrop campaign.
 *
 * A campaign list runs to thousands of rows, so this pages client-side over
 * the allocation array the campaign was created with, and lets the operator
 * filter down to the addresses that have not claimed yet - which is the only
 * question anyone actually asks of this screen.
 */

const Toolbar = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	margin-bottom: 1rem;
`

const Search = styled.input`
	flex: 1 1 auto;
	max-width: 22rem;
	padding: 0.45rem 0.6rem;
	border-radius: 0.375rem;
	border: 1px solid ${({ theme }) => theme.border};
	background: transparent;
	color: inherit;
	font-size: 0.875rem;
`

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
	font-size: 0.875rem;
`

const Th = styled.th`
	text-align: left;
	padding: 0.6rem 0.75rem;
	font-weight: 600;
	opacity: 0.7;
`

const Td = styled.td`
	padding: 0.6rem 0.75rem;
	border-top: 1px solid ${({ theme }) => theme.border};
`

const PAGE_SIZE = 25

export interface Recipient {
	address: string
	amount: string
	claimed: boolean
}

interface Props {
	recipients: Recipient[]
	symbol?: string
}

const AirdropRecipients: React.FC<Props> = ({ recipients, symbol = "" }) => {
	const [page, setPage] = useState(1)
	const [query, setQuery] = useState("")
	const [unclaimedOnly, setUnclaimedOnly] = useState(false)

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase()
		return recipients.filter((recipient) => {
			if (unclaimedOnly && recipient.claimed) return false
			if (!needle) return true
			return recipient.address.toLowerCase().includes(needle)
		})
	}, [recipients, query, unclaimedOnly])

	const claimedCount = useMemo(
		() => recipients.filter((recipient) => recipient.claimed).length,
		[recipients]
	)

	const pageRows = useMemo(() => {
		const start = (page - 1) * PAGE_SIZE
		return filtered.slice(start, start + PAGE_SIZE)
	}, [filtered, page])

	const percentClaimed =
		recipients.length === 0
			? 0
			: Math.round((claimedCount / recipients.length) * 100)

	return (
		<div>
			<Toolbar>
				<Search
					placeholder="Filter by address"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value)
						setPage(1)
					}}
				/>
				<label>
					<input
						type="checkbox"
						checked={unclaimedOnly}
						onChange={() => {
							setUnclaimedOnly((current) => !current)
							setPage(1)
						}}
					/>{" "}
					Unclaimed only
				</label>
				<Badge color="primary">
					{claimedCount}/{recipients.length} claimed
				</Badge>
			</Toolbar>

			<Progress percent={percentClaimed} />

			<Table>
				<thead>
					<tr>
						<Th>Address</Th>
						<Th>Allocation</Th>
						<Th>Status</Th>
					</tr>
				</thead>
				<tbody>
					{pageRows.map((recipient) => (
						<tr key={recipient.address}>
							<Td>{shortenAddress(recipient.address)}</Td>
							<Td>
								{recipient.amount} {symbol}
							</Td>
							<Td>
								<Badge color={recipient.claimed ? "green" : "secondary"}>
									{recipient.claimed ? "Claimed" : "Pending"}
								</Badge>
							</Td>
						</tr>
					))}
				</tbody>
			</Table>

			<Pagination
				currentPage={page}
				totalItems={filtered.length}
				pageSize={PAGE_SIZE}
				onPageChange={setPage}
			/>
		</div>
	)
}

export default AirdropRecipients
