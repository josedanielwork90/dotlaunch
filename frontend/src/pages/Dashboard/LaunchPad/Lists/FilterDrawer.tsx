import React, { useCallback, useEffect, useState } from "react"
import styled from "styled-components"

import Button from "../../../../components/common/Button"
import { Input } from "../../../../components/common/Inputs"
import { LIST_SALE_STATUS } from "../../../../constants"

/**
 * Slide-over filter panel for the presale list.
 *
 * Filters are held locally while the drawer is open and applied in one go on
 * close, so a half-typed token address does not fire a request per keystroke.
 */

const Backdrop = styled.div<{ open: boolean }>`
	position: fixed;
	inset: 0;
	background: rgba(15, 23, 42, 0.45);
	opacity: ${({ open }) => (open ? 1 : 0)};
	pointer-events: ${({ open }) => (open ? "auto" : "none")};
	transition: opacity 160ms ease;
	z-index: 40;
`

const Panel = styled.aside<{ open: boolean }>`
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	width: min(360px, 90vw);
	padding: 1.5rem;
	background: ${({ theme }) => theme.body};
	transform: translateX(${({ open }) => (open ? "0" : "100%")});
	transition: transform 200ms ease;
	z-index: 50;
	overflow-y: auto;
`

const Group = styled.div`
	margin-bottom: 1.25rem;
`

const GroupTitle = styled.h3`
	font-size: 0.8125rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	opacity: 0.7;
	margin-bottom: 0.5rem;
`

const Choice = styled.label`
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.25rem 0;
	font-size: 0.875rem;
`

export interface Filters {
	status: number[]
	tokenSale: string
	onlyMine: boolean
	kycOnly: boolean
}

export const EMPTY_FILTERS: Filters = {
	status: [],
	tokenSale: "",
	onlyMine: false,
	kycOnly: false,
}

interface Props {
	open: boolean
	initial?: Filters
	onClose: () => void
	onApply: (filters: Filters) => void
}

const FilterDrawer: React.FC<Props> = ({ open, initial, onClose, onApply }) => {
	const [draft, setDraft] = useState<Filters>(initial || EMPTY_FILTERS)

	useEffect(() => {
		if (open) setDraft(initial || EMPTY_FILTERS)
	}, [open, initial])

	const toggleStatus = useCallback((value: number) => {
		setDraft((current) => ({
			...current,
			status: current.status.includes(value)
				? current.status.filter((entry) => entry !== value)
				: [...current.status, value],
		}))
	}, [])

	const apply = () => {
		onApply(draft)
		onClose()
	}

	const reset = () => setDraft(EMPTY_FILTERS)

	return (
		<>
			<Backdrop open={open} onClick={onClose} />
			<Panel open={open} aria-hidden={!open}>
				<Group>
					<GroupTitle>Status</GroupTitle>
					{LIST_SALE_STATUS.map((status) => (
						<Choice key={status.value}>
							<input
								type="checkbox"
								checked={draft.status.includes(status.value)}
								onChange={() => toggleStatus(status.value)}
							/>
							{status.label}
						</Choice>
					))}
				</Group>

				<Group>
					<GroupTitle>Token</GroupTitle>
					<Input
						placeholder="Token address"
						value={draft.tokenSale}
						onChange={(event: any) =>
							setDraft((current) => ({ ...current, tokenSale: event.target.value }))
						}
					/>
				</Group>

				<Group>
					<GroupTitle>Other</GroupTitle>
					<Choice>
						<input
							type="checkbox"
							checked={draft.onlyMine}
							onChange={() =>
								setDraft((current) => ({ ...current, onlyMine: !current.onlyMine }))
							}
						/>
						Only sales I created
					</Choice>
					<Choice>
						<input
							type="checkbox"
							checked={draft.kycOnly}
							onChange={() =>
								setDraft((current) => ({ ...current, kycOnly: !current.kycOnly }))
							}
						/>
						KYC verified only
					</Choice>
				</Group>

				<Button onClick={apply}>Apply</Button>
				<Button onClick={reset}>Reset</Button>
			</Panel>
		</>
	)
}

export default FilterDrawer
