import { describe, expect, it } from "vitest";
import { highlightSource } from "./highlighter-engine";

describe("code highlighting", () => {
	it("preserves source and uses semantic syntax colors for lazy-loaded languages", async () => {
		const source = '# note\nprint("hello")\n';
		const lines = await highlightSource(source, "py");
		expect(lines.map((line) => line.map((token) => token.content).join("")).join("\n")).toBe(
			source,
		);
		expect(lines[0]?.some((token) => token.color === "var(--muted-foreground)")).toBe(true);
		expect(lines[1]?.some((token) => token.color === "var(--success-text)")).toBe(true);
	});
	it("concurrent languages keep their own source and unknown languages stay plain", async () => {
		const sources = ["const value = 42;", "fn main() {}", "<unknown>& raw\n"];
		const results = await Promise.all([
			highlightSource(sources[0] ?? "", "ts"),
			highlightSource(sources[1] ?? "", "rust"),
			highlightSource(sources[2] ?? "", "unknown-language"),
		]);
		expect(
			results.map((lines) =>
				lines.map((line) => line.map((token) => token.content).join("")).join("\n"),
			),
		).toEqual(sources);
	});
});
