import React from "react"
import styled from "styled-components"

/**
 * Numbered step indicator for the creation wizards.
 *
 * Hand-rolled rather than pulled from a library because the wizards need the
 * connector line to reflect completion state, and because a step has to be
 * clickable only once it has been reached.
 */

const List = styled.ol`
	display: flex;
	align-items: center;
	list-style: none;
	margin: 0 0 2rem;
	padding: 0;
`

const Item = styled.li<{ last: boolean }>`
	display: flex;
	align-items: center;
	flex: ${({ last }) => (last ? "0 0 auto" : "1 1 auto")};
`

const Marker = styled.button<{ state: "done" | "current" | "todo" }>`
	width: 2rem;
	height: 2rem;
	border-radius: 50%;
	border: 2px solid
		${({ state, theme }) =>
			state === "todo" ? theme.border : theme.primary};
	background: ${({ state, theme }) =>
		state === "todo" ? "transparent" : theme.primary};
	color: ${({ state, theme }) => (state === "todo" ? theme.text : "#fff")};
	font-size: 0.8125rem;
	font-weight: 600;
	cursor: ${({ state }) => (state === "todo" ? "not-allowed" : "pointer")};
	flex: 0 0 auto;
`

const Connector = styled.span<{ done: boolean }>`
	flex: 1 1 auto;
	height: 2px;
	margin: 0 0.5rem;
	background: ${({ done, theme }) => (done ? theme.primary : theme.border)};
`

const Label = styled.span<{ current: boolean }>`
	margin-left: 0.5rem;
	font-size: 0.8125rem;
	font-weight: ${({ current }) => (current ? 600 : 400)};
	white-space: nowrap;
`

interface Props {
	steps: string[]
	activeStep: number
	furthestStep?: number
	onStepClick?: (index: number) => void
}

const Stepper: React.FC<Props> = ({
	steps,
	activeStep,
	furthestStep,
	onStepClick,
}) => {
	const reached = furthestStep === undefined ? activeStep : furthestStep

	const stateOf = (index: number): "done" | "current" | "todo" => {
		if (index < activeStep) return "done"
		if (index === activeStep) return "current"
		return index <= reached ? "done" : "todo"
	}

	return (
		<List>
			{steps.map((step, index) => {
				const state = stateOf(index)
				const last = index === steps.length - 1

				return (
					<Item key={step} last={last}>
						<Marker
							type="button"
							state={state}
							disabled={state === "todo"}
							onClick={() => state !== "todo" && onStepClick?.(index)}
							aria-current={index === activeStep ? "step" : undefined}
						>
							{index < activeStep ? "✓" : index + 1}
						</Marker>
						<Label current={index === activeStep}>{step}</Label>
						{!last && <Connector done={index < activeStep} />}
					</Item>
				)
			})}
		</List>
	)
}

export default Stepper
