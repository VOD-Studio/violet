/**
 * range-to-anchor 模块测试
 *
 * 核心纯函数 buildAnchorFromRange：输入规范化的选区数据（块文本 + offset + 选中原文），
 * 输出 Anchor 五元组或 null（跨块）。jsdom 对 Selection/Range 支持有限，故测纯函数。
 */
import { describe, expect, it } from "vitest";
import { buildAnchorFromRange, sameBlock } from "../range-to-anchor";

describe("sameBlock", () => {
	it("两个块 id 相同 → true", () => {
		expect(sameBlock("abc12345", "abc12345")).toBe(true);
	});

	it("块 id 不同 → false", () => {
		expect(sameBlock("abc12345", "def67890")).toBe(false);
	});

	it("任一为 null → false（跨块或无效）", () => {
		expect(sameBlock(null, "abc12345")).toBe(false);
		expect(sameBlock("abc12345", null)).toBe(false);
		expect(sameBlock(null, null)).toBe(false);
	});
});

describe("buildAnchorFromRange", () => {
	const blockText = "hello world this is a test paragraph";

	it("单块内选区 → 返回完整五元组", async () => {
		const result = await buildAnchorFromRange({
			blockId: "abc12345",
			blockText,
			startOffset: 0,
			endOffset: 5,
		});
		expect(result).not.toBeNull();
		expect(result?.blockId).toBe("abc12345");
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(5);
		expect(result?.selectedText).toBe("hello");
		expect(result?.blockTextHash).toMatch(/^[0-9a-f]{8}$/);
	});

	it("块中部选区 → offset 和 selectedText 正确", async () => {
		const result = await buildAnchorFromRange({
			blockId: "abc12345",
			blockText,
			startOffset: 6,
			endOffset: 11,
		});
		expect(result?.selectedText).toBe("world");
		expect(result?.startOffset).toBe(6);
		expect(result?.endOffset).toBe(11);
	});

	it("跨块（blockId 为 null）→ 返回 null", async () => {
		const result = await buildAnchorFromRange({
			blockId: null,
			blockText: null,
			startOffset: 0,
			endOffset: 5,
		});
		expect(result).toBeNull();
	});

	it("startOffset >= endOffset → 返回 null（无效选区）", async () => {
		const result = await buildAnchorFromRange({
			blockId: "abc12345",
			blockText,
			startOffset: 5,
			endOffset: 5,
		});
		expect(result).toBeNull();
	});

	it("offset 越界 → 截断到合法范围", async () => {
		// endOffset 超出 blockText 长度时，selectedText 应截断到文本末尾
		const result = await buildAnchorFromRange({
			blockId: "abc12345",
			blockText: "short",
			startOffset: 0,
			endOffset: 100,
		});
		expect(result?.selectedText).toBe("short");
		expect(result?.endOffset).toBe(5);
	});

	it("blockTextHash 与 blockId 用同一文本算 → 一致", async () => {
		// blockTextHash 是「块内容快照」（创建时算），blockId 是运行时算；
		// 同一文本两者应相同（这是漂移检测的前提：未改文章时 hash 匹配 → 直接用 offset）
		const result = await buildAnchorFromRange({
			blockId: "abc12345",
			blockText,
			startOffset: 0,
			endOffset: 5,
		});
		// 重新算 blockText 的 hash 验证一致
		const { computeBlockId } = await import("../block-id");
		const expectedHash = await computeBlockId(blockText);
		expect(result?.blockTextHash).toBe(expectedHash);
	});
});
