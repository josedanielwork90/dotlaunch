import React, { useCallback, useMemo, useState } from "react"
import Papa from "papaparse"
import { utils } from "ethers"
import styled from "styled-components"

import Button from "../../../components/common/Button"
import Card from "../../../components/common/Card"
import { Input } from "../../../components/common/Inputs"

/**
 * Airdrop campaign creation.
 *
 * The recipient list is the hard part: projects arrive with a CSV exported
 * from a spreadsheet, so it has to be parsed, validated per row, and reported
 * back with line numbers rather than rejected wholesale.
 */

const Section = styled.section`
	margin-bottom: 2rem;
`

const Legend = styled.h2`
	font-size: 1.125rem;
	font-weight: 600;
	margin-bottom: 0.75rem;
`

const Problem = styled.li`
	color: ${({ theme }) => theme.warn};
	font-size: 0.8125rem;
`

const Summary = styled.div`
	display: flex;
	gap: 2rem;
	font-size: 0.875rem;
`

export interface Allocation {
	address: string
	amount: string
}

interface ParseResult {
	allocations: Allocation[]
	problems: string[]
}

/**
 * Parse a two-column CSV of address,amount.
 *
 * Rejects per row rather than per file: a project with one bad line should
 * be told which line, not handed a generic failure.
 */
export const parseAllocations = (csv: string, decimals: number): ParseResult => {
	const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true })
	const allocations: Allocation[] = []
	const problems: string[] = []
	const seen = new Set<string>()

	parsed.data.forEach((row, index) => {
		const line = index + 1
		const [rawAddress, rawAmount] = row

		if (!rawAddress || !rawAmount) {
			problems.push(`Line ${line}: expected "address,amount"`)
			return
		}

		const address = rawAddress.trim()
		if (!utils.isAddress(address)) {
			problems.push(`Line ${line}: "${address}" is not an address`)
			return
		}

		const key = address.toLowerCase()
		if (seen.has(key)) {
			problems.push(`Line ${line}: ${address} appears more than once`)
			return
		}

		try {
			const amount = utils.parseUnits(rawAmount.trim(), decimals)
			if (amount.isZero()) {
				problems.push(`Line ${line}: amount is zero`)
				return
			}
			seen.add(key)
			allocations.push({ address, amount: amount.toString() })
		} catch (error) {
			problems.push(`Line ${line}: "${rawAmount}" is not a valid amount`)
		}
	})

	return { allocations, problems }
}

interface Props {
	onSubmit?: (name: string, token: string, allocations: Allocation[]) => void
}

const AirdropCreate: React.FC<Props> = ({ onSubmit }) => {
	const [name, setName] = useState("")
	const [token, setToken] = useState("")
	const [decimals, setDecimals] = useState(18)
	const [csv, setCsv] = useState("")

	const { allocations, problems } = useMemo(
		() => (csv ? parseAllocations(csv, decimals) : { allocations: [], problems: [] }),
		[csv, decimals]
	)

	const total = useMemo(
		() =>
			allocations.reduce(
				(sum, allocation) => sum + Number(allocation.amount),
				0
			),
		[allocations]
	)

	const onFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = () => setCsv(String(reader.result || ""))
		reader.readAsText(file)
	}, [])

	const canSubmit =
		name.trim() !== "" &&
		utils.isAddress(token) &&
		allocations.length > 0 &&
		problems.length === 0

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				if (canSubmit && onSubmit) onSubmit(name, token, allocations)
			}}
		>
			<Section>
				<Legend>Campaign</Legend>
				<Input
					placeholder="Campaign name"
					value={name}
					onChange={(event: any) => setName(event.target.value)}
				/>
				<Input
					placeholder="Token address"
					value={token}
					onChange={(event: any) => setToken(event.target.value)}
				/>
				<Input
					type="number"
					placeholder="Token decimals"
					value={decimals}
					onChange={(event: any) => setDecimals(Number(event.target.value))}
				/>
			</Section>

			<Section>
				<Legend>Recipients</Legend>
				<input type="file" accept=".csv,text/csv" onChange={onFile} />
				<textarea
					rows={8}
					value={csv}
					placeholder="0xabc...,100"
					onChange={(event) => setCsv(event.target.value)}
				/>
			</Section>

			{problems.length > 0 && (
				<Card>
					<ul>
						{problems.slice(0, 20).map((problem) => (
							<Problem key={problem}>{problem}</Problem>
						))}
					</ul>
				</Card>
			)}

			<Summary>
				<span>{allocations.length} recipients</span>
				<span>{problems.length} problems</span>
				<span>{total > 0 ? "funded" : "empty"}</span>
			</Summary>

			<Button type="submit" disabled={!canSubmit}>
				Create campaign
			</Button>
		</form>
	)
}

export default AirdropCreate
