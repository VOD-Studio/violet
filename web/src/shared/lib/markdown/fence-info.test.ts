import { describe, expect, it } from "vitest";
import { parseFenceInfo } from "./fence-info";

describe("parseFenceInfo", () => {
	it("keeps ordinary syntax-highlighting languages", () => {
		expect(parseFenceInfo("typescript")).toEqual({
			language: "typescript",
			runnable: false,
			overrides: null,
		});
	});
	it.each([
		["js", "node"],
		["javascript", "node"],
		["rs", "rust"],
		["TS", "bun"],
		["typescript", "bun"],
		["python", "python"],
	])("normalizes runnable %s to %s", (language, expected) => {
		expect(parseFenceInfo(`${language} run`).language).toBe(expected);
	});
	it("preserves spaced JSON resource declarations", () => {
		expect(
			parseFenceInfo('python runnable {"timeout_secs": 10, "allow_network": false}'),
		).toEqual({
			language: "python",
			runnable: true,
			overrides: '{"timeout_secs":10,"allow_network":false}',
		});
	});
	it("does not mistake JSON string values or unknown tokens for the runnable marker", () => {
		expect(parseFenceInfo('js runner {"note":"runnable"}').runnable).toBe(false);
	});
	it("ignores malformed metadata without discarding the runnable marker", () => {
		expect(parseFenceInfo("rust runnable {broken}")).toEqual({
			language: "rust",
			runnable: true,
			overrides: null,
		});
	});
});
