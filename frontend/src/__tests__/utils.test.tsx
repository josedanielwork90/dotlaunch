import { BigNumber, utils as ethersUtils } from "ethers"

import {
	shortenAddress,
	formatNumberToCurrencyString,
	getNumberFromBN,
	getTokenNumberFromBN,
	getBNFromToken,
	getUTCTimestamp,
	getValidYoutubeLink,
	makeString,
} from "../utils"

/**
 * Presentation helpers.
 *
 * These run on every card in the list, so a wrong decimal here is visible on
 * the front page rather than in some corner of the app.
 */

describe("shortenAddress", () => {
	it("keeps the first six and last four characters", () => {
		expect(shortenAddress("0xAB1954B077a42564c1bade161163C336D3AFbc6a")).toBe(
			"0xAB19....bc6a"
		)
	})

	it("is stable for the same address", () => {
		const address = "0x1234567890abcdef1234567890abcdef12345678"
		expect(shortenAddress(address)).toBe(shortenAddress(address))
	})
})

describe("formatNumberToCurrencyString", () => {
	it("groups thousands", () => {
		expect(formatNumberToCurrencyString(1234567)).toMatch(/1\D?234\D?567/)
	})

	it("leaves small numbers alone", () => {
		expect(formatNumberToCurrencyString(12)).toBe("12")
	})
})

describe("BigNumber conversion", () => {
	it("unwraps a BigNumber", () => {
		expect(getNumberFromBN(BigNumber.from(4200))).toBe(4200)
	})

	it("formats using the token's decimals", () => {
		const raw = ethersUtils.parseUnits("125.5", 9)
		expect(getTokenNumberFromBN(raw, 9)).toBe("125.5")
	})

	it("defaults to 18 decimals", () => {
		const raw = ethersUtils.parseUnits("2", 18)
		expect(getTokenNumberFromBN(raw, 0)).toBe("2.0")
	})

	it("parses an amount into base units", () => {
		expect(getBNFromToken("1.25", 8).toString()).toBe("125000000")
	})

	it("round-trips through parse and format", () => {
		const amount = "913.125"
		expect(getTokenNumberFromBN(getBNFromToken(amount, 18), 18)).toBe(amount)
	})
})

describe("getUTCTimestamp", () => {
	it("converts an ISO string to whole seconds", () => {
		expect(getUTCTimestamp("2025-01-01T00:00:00Z")).toBe(1735689600)
	})
})

describe("getValidYoutubeLink", () => {
	it("rewrites a watch URL into an embed URL", () => {
		expect(getValidYoutubeLink("https://www.youtube.com/watch?v=abc123")).toBe(
			"https://www.youtube.com/embed/abc123"
		)
	})

	it("leaves an unrelated URL alone", () => {
		expect(getValidYoutubeLink("https://example.invalid/video")).toBe(
			"https://example.invalid/video"
		)
	})
})

describe("makeString", () => {
	it("returns a string of the requested length", () => {
		expect(makeString(16)).toHaveLength(16)
	})

	it("uses only alphanumeric characters", () => {
		expect(makeString(64)).toMatch(/^[A-Za-z0-9]+$/)
	})
})
