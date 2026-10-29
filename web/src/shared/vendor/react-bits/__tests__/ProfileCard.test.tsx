import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileCard } from "../ProfileCard";

describe("ProfileCard React Bits 组件", () => {
	afterEach(cleanup);

	it("渲染子内容并将装饰光晕隐藏于辅助技术", () => {
		const { container } = render(
			<ProfileCard>
				<a href="/profile">查看个人资料</a>
			</ProfileCard>,
		);

		expect(screen.getByRole("link", { name: "查看个人资料" }).getAttribute("href")).toBe(
			"/profile",
		);
		const decorations = container.querySelectorAll('[aria-hidden="true"]');
		expect(decorations).toHaveLength(2);
		for (const decoration of decorations) {
			expect(decoration.contains(screen.getByRole("link"))).toBe(false);
		}
	});
});
