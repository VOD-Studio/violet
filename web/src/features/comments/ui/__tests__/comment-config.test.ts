/**
 * toGridImages 测试
 *
 * 契约:多图缩略图必须与原图同比例(w 档保比例,不用 thumb 裁方)——
 * 预览占位层与比例探测依赖该前提;格子 bg-cover 显示不受参数变化影响。
 */
import { describe, expect, it } from "vitest";
import { toGridImages } from "../comment-config";

const pic = (url: string) => ({ url, width: 0, height: 0, size: 1024 });

describe("toGridImages", () => {
	it("多图:缩略图 w=400 保比例,不用 thumb 裁方", () => {
		const out = toGridImages([pic("/uploads/a.jpg"), pic("/uploads/b.jpg")]);
		for (const img of out) {
			expect(img.thumbnail).toContain("w=400");
			expect(img.thumbnail).toContain("format=webp");
			expect(img.thumbnail).not.toContain("thumb=");
		}
	});

	it("单图:w=800 保比例", () => {
		const out = toGridImages([pic("/uploads/a.jpg")]);
		expect(out[0].thumbnail).toContain("w=800");
		expect(out[0].thumbnail).not.toContain("thumb=");
	});

	it("单图 GIF:剥参数保动画", () => {
		const out = toGridImages([pic("/uploads/a.gif")]);
		expect(out[0].thumbnail).toBe("/uploads/a.gif");
	});
});
