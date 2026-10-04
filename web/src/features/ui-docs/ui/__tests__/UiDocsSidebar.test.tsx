import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { UiDocsSidebar } from "../UiDocsSidebar";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, onClick, ...props }: ComponentProps<"a"> & { to: string }) => (
		<a
			href={to}
			{...props}
			onClick={(event) => {
				event.preventDefault();
				onClick?.(event);
			}}
		>
			{children}
		</a>
	),
}));

describe("UiDocsSidebar", () => {
	it("按组件库文档分组展示全部指南和库组件", () => {
		render(<UiDocsSidebar currentPath="/ui/guides/introduction" />);
		expect(screen.getByRole("navigation", { name: "组件库文档目录" })).toBeTruthy();
		expect(screen.getByText("violet/ui")).toBeTruthy();
		for (const title of ["入门", "主题与样式", "组件", "开发", "智能体"]) {
			expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		}
		expect(screen.getAllByRole("link")).toHaveLength(24);
		expect(screen.queryByRole("link", { name: "CommentSection" })).toBeNull();
		expect(screen.queryByRole("link", { name: "CartoonPopover" })).toBeNull();
	});

	it("当前指南和组件各自只有一个活动链接", () => {
		const { rerender } = render(<UiDocsSidebar currentPath="/ui/guides/theming" />);
		expect(screen.getByRole("link", { name: "主题" }).getAttribute("aria-current")).toBe(
			"page",
		);
		rerender(<UiDocsSidebar currentPath="/ui/components/button/" />);
		expect(screen.getByRole("link", { name: "Button" }).getAttribute("aria-current")).toBe(
			"page",
		);
		expect(
			screen.getByRole("link", { name: "组件目录" }).getAttribute("aria-current"),
		).toBeNull();
		expect(
			screen
				.getAllByRole("link")
				.filter((link) => link.getAttribute("aria-current") === "page"),
		).toHaveLength(1);
	});

	it("点击页面链接通知移动导航关闭", () => {
		const onNavigate = vi.fn();
		render(<UiDocsSidebar currentPath="/ui/guides/introduction" onNavigate={onNavigate} />);
		fireEvent.click(screen.getByRole("link", { name: "Button" }));
		expect(onNavigate).toHaveBeenCalledOnce();
	});
});
