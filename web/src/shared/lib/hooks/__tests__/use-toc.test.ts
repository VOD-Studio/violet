import { extractToc, pickActiveHeading } from "@shared/lib/hooks/use-toc";
import { describe, expect, it } from "vitest";

describe("extractToc", () => {
    it("extracts h2/h3/h4 with explicit ids", () => {
        const html = `
			<h2 id="a">First</h2>
			<p>x</p>
			<h3 id="b">Sub</h3>
			<h4 id="c">Subsub</h4>
		`;
        expect(extractToc(html)).toEqual([
            { level: 2, id: "a", text: "First" },
            { level: 3, id: "b", text: "Sub" },
            { level: 4, id: "c", text: "Subsub" },
        ]);
    });

    it("extracts h4 and generates slug when missing", () => {
        const html = "<h4>Deep Section</h4>";
        expect(extractToc(html)).toEqual([{ level: 4, id: "deep-section", text: "Deep Section" }]);
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

    it("deduplicates ids for headings with identical text", () => {
        const html = "<h2>Summary</h2><p>x</p><h2>Summary</h2>";
        const toc = extractToc(html);
        expect(toc).toHaveLength(2);
        expect(new Set(toc.map((it) => it.id)).size).toBe(2);
    });
});

describe("pickActiveHeading", () => {
    it("returns null when no headings are visible", () => {
        expect(pickActiveHeading([], ["a", "b", "c"])).toBeNull();
    });

    it("returns the last visible heading in document order", () => {
        // a 和 b 已进入顶部高亮区，c 还没到 -> 当前章节是 b
        expect(pickActiveHeading(["a", "b"], ["a", "b", "c"])).toBe("b");
    });

    it("returns the only visible heading", () => {
        expect(pickActiveHeading(["b"], ["a", "b", "c"])).toBe("b");
    });

    it("ignores order of visibility, uses document order", () => {
        // 可见集合无序传入 {a,c}，文档顺序 [a,b,c] 中最后可见的是 c
        expect(pickActiveHeading(["c", "a"], ["a", "b", "c"])).toBe("c");
    });
});
