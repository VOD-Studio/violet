import { describe, expect, it } from "vitest";
import { EDITOR_GUIDE_BASE, rewriteChapterLinks } from "./chapters";

describe("project editor documentation links", () => {
	it("keeps chapter fragments and query parameters when rewriting repository links", () => {
		expect(
			rewriteChapterLinks("[公式](./math.md?lang=zh#物理宏表) [目录](./README.md#章节)"),
		).toBe(
			`[公式](${EDITOR_GUIDE_BASE}/math?lang=zh#物理宏表) [目录](${EDITOR_GUIDE_BASE}#章节)`,
		);
	});

	it("leaves unknown files, external URLs, and asset links untouched", () => {
		const source =
			"[待补文档](./missing.md) [外链](https://example.com/math.md) ![图](./diagram.svg)";
		expect(rewriteChapterLinks(source)).toBe(source);
	});
});
