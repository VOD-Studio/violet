/**
 * toGridImages 测试
 *
 * 契约:多图缩略图必须与原图同比例(w 档保比例,不用 thumb 裁方)——
 * 预览占位层与比例探测依赖该前提;格子 bg-cover 显示不受参数变化影响。
 */
import type { Comment } from "@entities/comment/model/types";
import { describe, expect, it } from "vitest";
import { buildArticleCommentConfig, toGridImages } from "../comment-config";

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

describe("buildArticleCommentConfig.map", () => {
	const { map } = buildArticleCommentConfig({ postId: "p1", isLoggedIn: true });
	const comment = (extra: Partial<Comment>): Comment => ({
		id: "c1",
		post_id: "p1",
		depth: 0,
		author_name: "y_defect",
		avatar_url: "",
		body: "hi",
		pictures: [],
		is_author: false,
		status: "approved",
		created_at: "2026-10-11T00:00:00Z",
		...extra,
	});

	it("有站内用户名：昵称链到个人空间", () => {
		expect(map(comment({ author_username: "y_defect" })).authorHref).toBe("/users/y_defect");
	});

	it("匿名或已注销作者：不生成链接", () => {
		expect(map(comment({})).authorHref).toBeUndefined();
	});
});
