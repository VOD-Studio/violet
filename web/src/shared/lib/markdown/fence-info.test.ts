import { describe, expect, it } from "vitest";
import { parseFenceInfo, parseHighlightedLines, serializeFenceInfo } from "./fence-info";

const emptyMetadata = { filename: null, highlightLines: null };

describe("parseFenceInfo", () => {
	it("keeps ordinary syntax-highlighting languages as authored", () => {
		expect(parseFenceInfo("TypeScript")).toEqual({
			language: "TypeScript",
			runnable: false,
			overrides: null,
			...emptyMetadata,
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
			...emptyMetadata,
		});
	});
	it("does not mistake quoted values or unknown tokens for runnable markers", () => {
		expect(
			parseFenceInfo('js runner title="run runnable {1,3}" {"note":"runnable"}').runnable,
		).toBe(false);
	});
	it("ignores malformed resource metadata without discarding the runnable marker", () => {
		expect(parseFenceInfo("rust runnable {broken}")).toEqual({
			language: "rust",
			runnable: true,
			overrides: null,
			...emptyMetadata,
		});
	});
	it("separates escaped titles, row ranges and trailing resource JSON", () => {
		const info = parseFenceInfo(
			'python title="src/hello \\"quoted\\".py" { 1, 3-5 } run {"timeout_secs": 10}',
		);
		expect(info).toEqual({
			language: "python",
			runnable: true,
			overrides: '{"timeout_secs":10}',
			filename: 'src/hello "quoted".py',
			highlightLines: "1,3-5",
		});
	});
	it.each([
		false,
		true,
	])("roundtrips titles without leaking metadata tokens (runnable=%s)", (runnable) => {
		const input = {
			language: "python",
			runnable,
			overrides: '{"timeout_secs":10,"allow_network":false}',
			filename: 'src/a "quote" \\ <tag> & `tick`\n.py',
			highlightLines: "1,3-999999999999999999999999999999999999",
		};
		expect(parseFenceInfo(serializeFenceInfo(input))).toEqual(input);
	});
});

describe("serializeFenceInfo", () => {
	it.each([
		"python run",
		"python\nrun",
		"python\u00a0run",
	])("does not promote a language attribute into metadata: %j", (language) => {
		const serialized = serializeFenceInfo({
			language,
			runnable: false,
			filename: "run runnable.py",
			highlightLines: "1,3-5",
			overrides: '{"timeout_secs":10}',
		});
		expect(serialized).toBe('python title="run runnable.py" {1,3-5} {"timeout_secs":10}');
		expect(parseFenceInfo(serialized).runnable).toBe(false);
	});
});

describe("parseHighlightedLines", () => {
	it("bounds even enormous ranges to actual source rows and sorts unique rows", () => {
		expect(parseHighlightedLines("3-99999999999999999999999999999,1,3,2-4", 5)).toEqual([
			1, 2, 3, 4, 5,
		]);
		expect(parseHighlightedLines("99999999999999999999999999999999999999", 5)).toEqual([]);
	});
	it("ignores reversed ranges, zero and rows beyond the source", () => {
		expect(parseHighlightedLines("9-2,0,1,8", 4)).toEqual([1]);
	});
	it.each([
		null,
		undefined,
		"",
		"1,-3",
		"1,a",
		"1.5",
		"1--5",
	])("rejects invalid row syntax %s", (spec) => {
		expect(parseHighlightedLines(spec, 5)).toEqual([]);
	});
	it.each([
		0,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])("does not expand invalid source length %s", (length) => {
		expect(parseHighlightedLines("1-99999999999999999999999999", length)).toEqual([]);
	});
});
