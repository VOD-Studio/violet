// @vitest-environment node

import { readFileSync } from "node:fs";
import { displayUrl, normalizeLinkUrl, tokenizeLinks } from "@shared/lib/linkify";
import { describe, expect, it } from "vitest";

interface SharedURLFixtures {
	tokenization: {
		name: string;
		input: string;
		matches: {
			text: string;
			href: string;
			key: string;
			startUtf16: number;
			endUtf16: number;
			startByte: number;
			endByte: number;
			startRune: number;
			endRune: number;
		}[];
	}[];
	normalization: {
		name: string;
		input: string;
		key: string;
	}[];
}

const fixtures: SharedURLFixtures = JSON.parse(
	readFileSync(
		new URL(
			"../../../../../api/internal/domain/linkpreview/testdata/urls.json",
			import.meta.url,
		),
		"utf8",
	),
);

describe("tokenizeLinks shared Go/TS fixtures", () => {
	for (const sample of fixtures.tokenization) {
		it(sample.name, () => {
			const matches = tokenizeLinks(sample.input);
			expect(matches).toEqual(
				sample.matches.map((match) => ({
					start: match.startUtf16,
					end: match.endUtf16,
					href: match.href,
					text: match.text,
				})),
			);
			expect(matches.map((match) => normalizeLinkUrl(match.href))).toEqual(
				sample.matches.map((match) => match.key),
			);
			for (let index = 0; index < matches.length; index++) {
				const match = matches[index];
				const expected = sample.matches[index];
				expect(sample.input.slice(match.start, match.end)).toBe(match.text);
				expect(new TextEncoder().encode(sample.input.slice(0, match.start)).length).toBe(
					expected.startByte,
				);
				expect(new TextEncoder().encode(sample.input.slice(0, match.end)).length).toBe(
					expected.endByte,
				);
				expect(Array.from(sample.input.slice(0, match.start)).length).toBe(
					expected.startRune,
				);
				expect(Array.from(sample.input.slice(0, match.end)).length).toBe(expected.endRune);
			}
		});
	}
});

describe("normalizeLinkUrl shared Go/TS fixtures", () => {
	for (const sample of fixtures.normalization) {
		it(sample.name, () => {
			expect(normalizeLinkUrl(sample.input)).toBe(sample.key);
		});
	}
});

describe("displayUrl", () => {
	it("keeps short URLs unchanged", () => {
		expect(displayUrl("https://example.com/a")).toBe("https://example.com/a");
	});

	it("preserves the first 30 and last 20 code units", () => {
		const raw = `https://example.com/${"x".repeat(80)}`;
		expect(displayUrl(raw)).toBe(`${raw.slice(0, 30)}…${raw.slice(-20)}`);
	});
});
