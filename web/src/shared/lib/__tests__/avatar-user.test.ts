import { describe, expect, it } from "vitest";
import { toAvatarItem } from "../avatar-user";

describe("toAvatarItem", () => {
	it("普通头像走缩略图参数，不直传原图", () => {
		const item = toAvatarItem({
			username: "alice",
			avatar_url: "/uploads/avatar/2026/07/08/000655.big.webp",
		});
		expect(item.src).toContain("w=200");
		expect(item.src).toContain("thumb=200x200");
		expect(item.src).toContain("format=webp");
	});

	it("GIF 头像保留原路径，不剥动画帧", () => {
		const item = toAvatarItem({
			username: "bob",
			avatar_url: "/uploads/avatar/2026/07/08/dance.gif",
		});
		expect(item.src).not.toContain("format=webp");
	});

	it("没有头像时不给 src，由首字兜底而不请求远程默认头像", () => {
		expect(toAvatarItem({ username: "carol", avatar_url: "" }).src).toBeUndefined();
	});

	it("显示名优先，缺省回退用户名", () => {
		expect(toAvatarItem({ username: "dave", display_name: "戴夫", avatar_url: "" }).name).toBe(
			"戴夫",
		);
		expect(toAvatarItem({ username: "dave", display_name: "", avatar_url: "" }).name).toBe(
			"dave",
		);
	});
});
