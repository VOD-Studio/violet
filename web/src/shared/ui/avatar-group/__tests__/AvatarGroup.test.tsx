import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarGroup } from "../AvatarGroup";

/**
 * AvatarGroup 必须对 avatar_url 套 avatarUrl() 生成缩略图参数。
 *
 * 背景：曾因直传原图（如 9397×16383 的头像 webp），文章列表每张卡解码巨图，
 * 单次 Decode Image 耗时 0.5–0.8s，导致页面卡顿（Chrome Performance trace
 * 实测）。avatarUrl() 拼出 ?w=200&thumb=200x200&format=webp，后端动态缩放，
 * 避免浏览器解码原图。
 */
describe("AvatarGroup avatar_url 处理", () => {
	it("普通图片走缩略图参数，不直传原图", () => {
		render(
			<AvatarGroup
				users={[
					{
						username: "alice",
						avatar_url: "/uploads/avatar/2026/07/08/000655.big.webp",
					},
				]}
			/>,
		);

		const img = screen.getByAltText("alice") as HTMLImageElement;
		expect(img.src).toContain("w=200");
		expect(img.src).toContain("thumb=200x200");
		expect(img.src).toContain("format=webp");
	});

	it("GIF avatar 保留原路径，不剥动画帧", () => {
		// GIF 走后端 format=webp 会丢动画，avatarUrl 内部特判直传原 path
		render(
			<AvatarGroup
				users={[
					{
						username: "bob",
						avatar_url: "/uploads/avatar/2026/07/08/dance.gif",
					},
				]}
			/>,
		);

		const img = screen.getByAltText("bob") as HTMLImageElement;
		expect(img.src).not.toContain("format=webp");
	});

	it("空 avatar_url 走首字母兜底，不请求远程图", () => {
		// 空值保留空串，渲染层走首字母占位（无外部依赖）
		render(<AvatarGroup users={[{ username: "carol", avatar_url: "" }]} />);

		expect(screen.getByText("C")).toBeDefined();
		expect(screen.queryByAltText("carol")).toBeNull();
	});
});
