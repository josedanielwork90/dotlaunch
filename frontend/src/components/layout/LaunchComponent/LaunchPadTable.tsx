import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import styled from "styled-components"

import Badge from "../../common/Badge"
import Progress from "../../common/Progress"
import { shortenAddress, getSaleStatus } from "../../../utils"
import { LIST_SALE_STATUS } from "../../../constants"

/**
 * Dense table view of the presale list.
 *
 * The card grid is the primary browse experience, but anyone comparing a
 * dozen sales on hard numbers wants them in columns. Sorting is client-side
 * over the current page only - the API sorts across the whole set.
 */

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
	font-size: 0.875rem;
`

const Th = styled.th<{ sortable?: boolean }>`
	text-align: left;
	padding: 0.65rem 0.75rem;
	white-space: nowrap;
	font-weight: 600;
	opacity: 0.75;
	cursor: ${({ sortable }) => (sortable ? "pointer" : "default")};
	user-select: none;
`

const Td = styled.td`
	padding: 0.65rem 0.75rem;
	border-top: 1px solid ${({ theme }) => theme.border};
	vertical-align: middle;
`

const Numeric = styled(Td)`
	text-align: right;
	font-variant-numeric: tabular-nums;
`

type SortKey = "name" | "raised" | "hardcap" | "start"

interface Props {
	rows: any[]
	loading?: boolean
}

const COLUMNS: Array<{ key: SortKey | null; label: string }> = [
	{ key: "name", label: "Project" },
	{ key: null, label: "Address" },
	{ key: null, label: "Status" },
	{ key: "raised", label: "Raised" },
	{ key: "hardcap", label: "Hard cap" },
	{ key: "start", label: "Opens" },
	{ key: null, label: "Progress" },
]

const LaunchPadTable: React.FC<Props> = ({ rows, loading = false }) => {
	const [sortKey, setSortKey] = useState<SortKey>("start")
	const [ascending, setAscending] = useState(false)
	const [selected, setSelected] = useState<string[]>([])

	const sorted = useMemo(() => {
		const copy = [...rows]
		copy.sort((a, b) => {
			const direction = ascending ? 1 : -1
			switch (sortKey) {
				case "name":
					return direction * String(a.name || "").localeCompare(String(b.name || ""))
				case "raised":
					return direction * (Number(a.totalRaised) - Number(b.totalRaised))
				case "hardcap":
					return direction * (Number(a.hardcap) - Number(b.hardcap))
				default:
					return direction * (Number(a.startTime) - Number(b.startTime))
			}
		})
		return copy
	}, [rows, sortKey, ascending])

	const toggle = (key: SortKey | null) => {
		if (key === null) return
		if (key === sortKey) setAscending((current) => !current)
		else {
			setSortKey(key)
			setAscending(true)
		}
	}

	const progressOf = (row: any) => {
		const cap = Number(row.hardcap)
		if (!cap) return 0
		return Math.min(100, Math.round((Number(row.totalRaised) / cap) * 100))
	}

	if (loading) return <p>Loading…</p>
	if (rows.length === 0) return <p>No presales match those filters.</p>

	return (
		<Table>
			<thead>
				<tr>
					{COLUMNS.map((column) => (
						<Th
							key={column.label}
							sortable={column.key !== null}
							onClick={() => toggle(column.key)}
						>
							{column.label}
							{column.key === sortKey ? (ascending ? " ↑" : " ↓") : ""}
						</Th>
					))}
				</tr>
			</thead>
			<tbody>
				{sorted.map((row) => {
					const status = getSaleStatus(row)
					const label = LIST_SALE_STATUS.find((entry) => entry.value === status)

					return (
						<tr key={row.launchpad}>
							<Td>
								<Link to={`/dashboard/launchpad/${row.launchpad}`}>
									{row.name || "Unnamed"}
								</Link>
							</Td>
							<Td>{shortenAddress(row.launchpad)}</Td>
							<Td>
								<Badge color={label?.color}>{label?.label}</Badge>
							</Td>
							<Numeric>{row.totalRaised}</Numeric>
							<Numeric>{row.hardcap}</Numeric>
							<Td>{new Date(Number(row.startTime)).toLocaleDateString()}</Td>
							<Td>
								<Progress percent={progressOf(row)} />
							</Td>
						</tr>
					)
				})}
			</tbody>
		</Table>
	)
}


/**
 * Serialise the current selection as CSV.
 *
 * Operators reconcile raises in a spreadsheet, and asking them to copy
 * addresses out of the DOM by hand was the single most common support
 * request this view attracted.
 */
export const toCsv = (rows: any[]): string => {
	const header = [
		"name",
		"launchpad",
		"token",
		"raised",
		"hardcap",
		"start",
		"end",
	]

	const escape = (value: unknown) => {
		const text = value === undefined || value === null ? "" : String(value)
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
	}

	const lines = rows.map((row) =>
		[
			row.name,
			row.launchpad,
			row.tokenSale,
			row.totalRaised,
			row.hardcap,
			new Date(Number(row.startTime)).toISOString(),
			new Date(Number(row.endTime)).toISOString(),
		]
			.map(escape)
			.join(",")
	)

	return [header.join(","), ...lines].join("\n")
}

/** Hand the CSV to the browser as a download. */
export const downloadCsv = (rows: any[], filename = "presales.csv") => {
	const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })
	const url = URL.createObjectURL(blob)

	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	document.body.removeChild(anchor)

	URL.revokeObjectURL(url)
}

export default LaunchPadTable
