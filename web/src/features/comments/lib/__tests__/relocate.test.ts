/**
 * relocate 模块测试 —— PRD-0001 风险最高的算法，必须穷尽三路径。
 *
 * 三态重定位机：
 *   1. located（hash 匹配）→ 直接用 offset（快路径，99% 场景）
 *   2. located（fuzzy）→ hash 不匹配，用 selectedText 子串查找 + context 唯一化
 *   3. page-level → 全失败降级（不丢失内容，作为页面级评论展示）
 */
import { describe, expect, it } from "vitest";
import { type RelocateResult, relocate } from "../relocate";
import type { Anchor } from "../types";

const makeAnchor = (overrides: Partial<Anchor> = {}): Anchor => ({
	blockId: "abc12345",
	startOffset: 6,
	endOffset: 11,
	selectedText: "world",
	blockTextHash: "abc12345", // 默认与 blockId 一致（模拟「未改文章」hash 匹配）
	...overrides,
});

const makeBlock = (id: string, text: string) => ({ id, text });

describe("relocate — 路径 1: hash 匹配（快路径）", () => {
	it("anchor.blockTextHash 与候选块 blockId 一致 → located，offset 直接用", async () => {
		const anchor = makeAnchor({ startOffset: 0, endOffset: 5, selectedText: "hello" });
		const blocks = [makeBlock("abc12345", "hello world")];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		expect(result.blockId).toBe("abc12345");
		expect(result.startOffset).toBe(0);
		expect(result.endOffset).toBe(5);
	});

	it("多个候选块时，按 anchor.blockId 定位到对应块", async () => {
		const anchor = makeAnchor({
			blockId: "target01",
			blockTextHash: "target01",
			startOffset: 0,
			endOffset: 3,
		});
		const blocks = [
			makeBlock("other001", "foo bar"),
			makeBlock("target01", "abc def"),
			makeBlock("another", "xyz"),
		];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		expect(result.blockId).toBe("target01");
	});
});

describe("relocate — 路径 2: hash 不匹配 + fuzzy 子串查找", () => {
	it("anchor.blockTextHash 不匹配，但 selectedText 在块内单次命中 → located fuzzy", async () => {
		// 块内容已改（blockId 变了），但 selectedText "world" 仍在块内
		const anchor = makeAnchor({
			blockId: "oldblock",
			blockTextHash: "oldblock",
			startOffset: 6,
			endOffset: 11,
			selectedText: "unique",
		});
		const blocks = [makeBlock("newblock", "this is a unique word here")];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		// fuzzy 重定位：基于 selectedText 在新块内查找新 offset
		expect(result.blockId).toBe("newblock");
		expect(result.selectedText).toBe("unique");
		// "unique" 在 "this is a unique word here" 中起始于 offset 10
		expect(result.startOffset).toBe(10);
		expect(result.endOffset).toBe(16);
	});

	it("多次命中 → 用前后 16 字 context 唯一化", async () => {
		// "重复" 在块内出现两次，需要 context 区分
		const anchor = makeAnchor({
			blockId: "old",
			blockTextHash: "old",
			startOffset: 0,
			endOffset: 2,
			selectedText: "重复",
		});
		// 上下文：anchor 原本在第一处（前面是"第一"），用 context 区分
		const blocks = [makeBlock("new", "第一重复内容中间第二重复内容结尾")];

		const result = await relocate(anchor, blocks);
		// 多次命中 + context 能唯一化 → located（命中第一处）
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		expect(result.startOffset).toBe(2); // "第一" 后的 "重复"
	});

	it("多次命中且 context 仍无法唯一化 → 退化到第一个匹配", async () => {
		const anchor = makeAnchor({
			blockId: "old",
			blockTextHash: "old",
			startOffset: 0,
			endOffset: 1,
			selectedText: "a",
		});
		// "a" 多次出现且 context 也无法区分 → 退化到第一个
		const blocks = [makeBlock("new", "a a a a a")];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("located");
		if (result.kind !== "located") return;
		expect(result.startOffset).toBe(0);
	});
});

describe("relocate — 路径 3: 全失败降级", () => {
	it("hash 不匹配 + selectedText 在块内找不到 → page-level", async () => {
		const anchor = makeAnchor({
			blockId: "old",
			blockTextHash: "old",
			startOffset: 0,
			endOffset: 5,
			selectedText: "gone",
		});
		const blocks = [makeBlock("new", "完全不同的内容")];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("page-level");
	});

	it("候选块列表为空 → page-level", async () => {
		const anchor = makeAnchor();
		const result = await relocate(anchor, []);
		expect(result.kind).toBe("page-level");
	});

	it("anchor.blockId 在候选块中找不到 + fuzzy 也失败 → page-level", async () => {
		const anchor = makeAnchor({
			blockId: "missing",
			blockTextHash: "missing",
			selectedText: "notfound",
		});
		const blocks = [makeBlock("other1", "some text"), makeBlock("other2", "other text")];

		const result = await relocate(anchor, blocks);
		expect(result.kind).toBe("page-level");
	});
});

describe("relocate — 部分修改场景", () => {
	it("selectedText 前缀修改 → fuzzy 仍能命中剩余部分", async () => {
		// 原选中 "world"，文章改为 "xorld"（前缀改了一个字）
		// fuzzy 用子串查找："world" 找不到，但若放宽到「最长公共子串」应能命中
		// 本期实现策略：严格子串匹配，前缀改导致找不到 → 降级（保守，不误定位）
		const anchor = makeAnchor({
			blockId: "old",
			blockTextHash: "old",
			selectedText: "world",
		});
		const blocks = [makeBlock("new", "hello xorld")];

		const result = await relocate(anchor, blocks);
		// 严格子串：找不到 "world" → 降级
		expect(result.kind).toBe("page-level");
	});
});

// 编译期断言：RelocateResult 是 discriminated union
const _checkUnion = (r: RelocateResult) => {
	switch (r.kind) {
		case "located":
			return r.blockId + r.startOffset + r.endOffset + r.selectedText;
		case "page-level":
			return r.reason;
	}
};
void _checkUnion;
