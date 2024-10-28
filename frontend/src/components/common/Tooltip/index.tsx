import React, { useCallback, useId, useState } from "react"
import styled from "styled-components"

/**
 * Hover and focus tooltip.
 *
 * Positioned with CSS rather than a portal, which keeps it dependency-free
 * but does mean it will clip inside a container with `overflow: hidden`.
 * Opens on focus as well as hover so the sale-parameter hints are reachable
 * from the keyboard.
 */

const Wrapper = styled.span`
	position: relative;
	display: inline-flex;
	align-items: center;
`

const Bubble = styled.span<{ placement: Placement; open: boolean }>`
	position: absolute;
	z-index: 30;
	min-width: 8rem;
	max-width: 16rem;
	padding: 0.45rem 0.6rem;
	border-radius: 0.375rem;
	background: ${({ theme }) => theme.tooltipBg || "rgba(15, 23, 42, 0.95)"};
	color: #f8fafc;
	font-size: 0.75rem;
	line-height: 1.4;
	text-align: left;
	pointer-events: none;
	opacity: ${({ open }) => (open ? 1 : 0)};
	transition: opacity 120ms ease;

	${({ placement }) =>
		placement === "top"
			? "bottom: 100%; left: 50%; transform: translate(-50%, -0.4rem);"
			: placement === "bottom"
			? "top: 100%; left: 50%; transform: translate(-50%, 0.4rem);"
			: placement === "left"
			? "right: 100%; top: 50%; transform: translate(-0.4rem, -50%);"
			: "left: 100%; top: 50%; transform: translate(0.4rem, -50%);"}
`

type Placement = "top" | "bottom" | "left" | "right"

interface Props {
	label: React.ReactNode
	placement?: Placement
	children: React.ReactNode
}

const Tooltip: React.FC<Props> = ({ label, placement = "top", children }) => {
	const [open, setOpen] = useState(false)
	const id = useId()

	const show = useCallback(() => setOpen(true), [])
	const hide = useCallback(() => setOpen(false), [])

	const onKeyDown = useCallback((event: React.KeyboardEvent) => {
		if (event.key === "Escape") setOpen(false)
	}, [])

	return (
		<Wrapper
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={hide}
			onKeyDown={onKeyDown}
		>
			<span aria-describedby={open ? id : undefined} tabIndex={0}>
				{children}
			</span>
			<Bubble id={id} role="tooltip" placement={placement} open={open}>
				{label}
			</Bubble>
		</Wrapper>
	)
}

export default Tooltip
