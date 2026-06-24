import { extractToc } from "@shared/lib/hooks/use-toc";
import { describe, expect, it } from "vitest";

describe("extractToc", () => {
	it("extracts h2/h3 with explicit ids", () => {
		const html = `
			<h2 id="a">First</h2>
			<p>x</p>
			<h3 id="b">Sub</h3>
		`;
		expect(extractToc(html)).toEqual([
			{ level: 2, id: "a", text: "First" },
			{ level: 3, id: "b", text: "Sub" },
		]);
	});

	it("generates slug id when missing", () => {
		const html = "<h2>Hello World!</h2>";
		expect(extractToc(html)).toEqual([{ level: 2, id: "hello-world", text: "Hello World!" }]);
	});

	it("strips inner tags from text", () => {
		const html = '<h2 id="x">Has <code>code</code> inside</h2>';
		expect(extractToc(html)[0].text).toBe("Has code inside");
	});

	it("handles Chinese heading slug", () => {
		const html = "<h2>你好 世界</h2>";
		expect(extractToc(html)[0].id).toBe("你好-世界");
	});

	it("returns empty for no headings", () => {
		expect(extractToc("<p>nope</p>")).toEqual([]);
	});
});
