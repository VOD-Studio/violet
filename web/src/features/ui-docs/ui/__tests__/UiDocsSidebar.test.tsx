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
