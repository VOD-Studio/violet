import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignSystemSidebar } from "../DesignSystemSidebar";

// Mock @tanstack/react-router 中的 Link 组件
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		onClick,
		className,
		"aria-current": ariaCurrent,
	}: {
		children: React.ReactNode;
		to: string;
		onClick?: () => void;
		className?: string;
		"aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false";
	}) => (
		<a href={to} onClick={onClick} className={className} aria-current={ariaCurrent}>
			{children}
		</a>
	),
}));

describe("DesignSystemSidebar", () => {
	it("渲染卷首标题与各卷别分组", () => {
		render(<DesignSystemSidebar currentPath="/design-system/principles" />);
		expect(screen.getByText("营造法式")).toBeTruthy();
		expect(screen.getByText("卷一 · 纲纪准则")).toBeTruthy();
		expect(screen.getByText("卷二 · 营造法度")).toBeTruthy();
		expect(screen.getByText("卷三 · 构件陈列")).toBeTruthy();
	});

	it("当前活跃章节呈现 aria-current=page", () => {
		render(<DesignSystemSidebar currentPath="/design-system/palette" />);
		const paletteLink = screen.getByRole("link", { name: /色板生成器/ });
		expect(paletteLink.getAttribute("aria-current")).toBe("page");
	});

	it("二级菜单展开与收起交互正常", () => {
		render(<DesignSystemSidebar currentPath="/design-system/principles" />);
		const expandBtn = screen.getByRole("button", { name: /展开组件目录子章节/ });
		fireEvent.click(expandBtn);

		expect(screen.getByText("评论区")).toBeTruthy();
	});

	it("点击导航项触发 onNavigate 回调", () => {
		const onNavigate = vi.fn();
		render(
			<DesignSystemSidebar currentPath="/design-system/principles" onNavigate={onNavigate} />,
		);
		fireEvent.click(screen.getByRole("link", { name: /设计原则/ }));
		expect(onNavigate).toHaveBeenCalled();
	});

	it("访问二级子路由时所属分组自动展开并高亮子项", () => {
		render(<DesignSystemSidebar currentPath="/design-system/specimens/comment-section" />);
		const activeSubLink = screen.getByRole("link", { name: "评论区" });
		expect(activeSubLink.getAttribute("aria-current")).toBe("page");
	});
});
