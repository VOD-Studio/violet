/**
 * shouldRenderRepliesBlock 行为表:两模式 × 总数未知/零/正 × pending 的渲染矩阵。
 */
import { describe, expect, it } from "vitest";
import { shouldRenderRepliesBlock } from "../CommentItem";

describe("shouldRenderRepliesBlock", () => {
	const item = (repliesTotal?: number, previewLen = 0) => ({
		repliesTotal,
		repliesPreview: Array.from({ length: previewLen }, (_, i) => ({ id: `r${i}` })),
	});

	describe("toggle 模式(推文)", () => {
		it("总数未知时渲染(展开才拉取)", () => {
			expect(shouldRenderRepliesBlock(item(undefined), "toggle", 0)).toBe(true);
		});
		it("总数为 0 不渲染", () => {
			expect(shouldRenderRepliesBlock(item(0), "toggle", 0)).toBe(false);
		});
		it("总数为正渲染", () => {
			expect(shouldRenderRepliesBlock(item(3), "toggle", 0)).toBe(true);
		});
	});

	describe("preview 模式(文章)", () => {
		it("总数未知不渲染(无可见内容即无入口)", () => {
			expect(shouldRenderRepliesBlock(item(undefined), "preview", 0)).toBe(false);
		});
		it("总数为正渲染", () => {
			expect(shouldRenderRepliesBlock(item(5, 3), "preview", 0)).toBe(true);
		});
		it("仅预览非空也渲染(总数缺失但后端给了预览)", () => {
			expect(shouldRenderRepliesBlock(item(undefined, 2), "preview", 0)).toBe(true);
		});
		it("总数为 0 且预览为空不渲染", () => {
			expect(shouldRenderRepliesBlock(item(0), "preview", 0)).toBe(false);
		});
	});

	it("pending 回复在两模式下都强制渲染", () => {
		expect(shouldRenderRepliesBlock(item(0), "toggle", 1)).toBe(true);
		expect(shouldRenderRepliesBlock(item(0), "preview", 1)).toBe(true);
	});
});
