/**
 * NavMenu 子菜单渲染测试
 *
 * 覆盖「可折叠父项」行为：
 * - 带 children 的导航项渲染为父项按钮（aria-expanded 可见）。
 * - 默认折叠，子项不可见；用户手动点按后展开/收起。
 * - 点击父项切换展开/折叠（双向）。
 * - 普通叶子项（无 children）仍渲染为链接而非按钮。
 *
 * 断言风格跟随项目惯例（.length / .toBeTruthy / .toBeFalsy，无 jest-dom）。
 * mock 策略：useMe 返回超管（所有项可见，绕开权限分支）；
 * Link 退化为普通 <a> 以脱离 RouterProvider 上下文。
 */

import { TooltipProvider } from "@shared/ui/base/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 受控的当前 pathname，各用例通过 setPath 设置。
// 必须用 vi.hoisted 声明：vi.mock factory 被 vitest 提升到模块顶层独立执行，
// 直接闭包捕获模块级 let 会拿到滞后一次的旧值（跨用例串扰），vi.hoisted 保证
// 与 factory 同上下文初始化。
const { mockPath } = vi.hoisted(() => ({ mockPath: { value: "/admin" } }));
const setPath = (p: string) => {
	mockPath.value = p;
};

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		children,
		className,
		onClick,
	}: {
		to: string;
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
	}) => (
		<a href={to} className={className} onClick={onClick} data-testid={`link-${to}`}>
			{children}
		</a>
	),
	useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
		select({ location: { pathname: mockPath.value } }),
}));

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({
		data: { is_root: true, permissions: ["*"] },
	}),
}));

// 友链菜单项的 pending 计数角标自带 useQuery，本测试无 QueryClientProvider，替身掉
vi.mock("@features/admin-friend-links/ui/FriendLinkNavBadge", () => ({
	FriendLinkNavBadge: () => null,
}));

import { useAdminSidebarStore } from "../../admin-sidebar-store";
import { NavMenu } from "../NavMenu";

/**
 * store 状态隔离：admin-sidebar-store 用 zustand persist（localStorage），
 * expandedGroups 是模块级单例，跨用例泄漏（命中路由用例会写入 expanded=true）。
 * zustand store 实例 hydrate 后内存状态不随 localStorage.clear 重置，
 * 故直接用 store API 重置 expandedGroups 内存 + 清 localStorage 防持久化污染。
 */
beforeEach(() => {
	useAdminSidebarStore.setState({ expandedGroups: {} });
	localStorage.clear();
	setPath("/admin");
});

/** 取「站点设置」父项按钮：限定到带 aria-expanded 属性的 button */
const getSettingsParent = () =>
	screen
		.getAllByRole("button", { name: /站点设置/ })
		.find((b) => b.hasAttribute("aria-expanded"));

describe("NavMenu 子菜单渲染", () => {
	it("默认折叠，子项不渲染", () => {
		setPath("/admin/settings/github");
		render(<NavMenu />);

		// 即使命中子项路由，父项仍默认折叠
		expect(getSettingsParent()?.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryAllByTestId("link-/admin/settings/github").length).toBe(0);
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBe(0);
	});

	it("手动点击父项后展开子项", () => {
		setPath("/admin/settings/github");
		render(<NavMenu />);

		const parent = getSettingsParent();
		expect(parent?.getAttribute("aria-expanded")).toBe("false");

		// 手动展开
		fireEvent.click(parent as HTMLElement);
		expect(parent?.getAttribute("aria-expanded")).toBe("true");
		expect(screen.queryAllByTestId("link-/admin/settings/github").length).toBeGreaterThan(0);
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBeGreaterThan(0);
	});

	it("点击父项切换展开/折叠（双向）", () => {
		setPath("/admin/posts");
		render(<NavMenu />);

		const parent = getSettingsParent();
		// 初始折叠，子项不可见
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBe(0);

		// 点击展开（fireEvent 包裹 act，确保 zustand 状态更新同步到 DOM）
		fireEvent.click(parent as HTMLElement);
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBeGreaterThan(0);
		expect(parent?.getAttribute("aria-expanded")).toBe("true");

		// 再次点击折叠
		fireEvent.click(parent as HTMLElement);
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBe(0);
		expect(parent?.getAttribute("aria-expanded")).toBe("false");
	});

	it("普通叶子项（无 children）仍渲染为链接而非按钮", () => {
		setPath("/admin");
		render(<NavMenu />);

		// 文章管理是叶子项 → 渲染为 <a>（testid 存在）
		expect(screen.queryAllByTestId("link-/admin/posts").length).toBeGreaterThan(0);
	});

	it("子路由命中且分组折叠时父项显示激活态", () => {
		setPath("/admin/settings/general");
		render(<NavMenu />);

		// 分组默认折叠（子项不可见）→ 父项承担激活态
		// （before:bg-primary 是激活态独有标记，bg-accent 会被 hover:bg-accent 误判）
		expect(getSettingsParent()?.className).toContain("before:bg-primary");

		// 手动展开分组后子项可见，父项激活态移交给子项，避免重复高亮
		fireEvent.click(getSettingsParent() as HTMLElement);
		expect(getSettingsParent()?.className).not.toContain("before:bg-primary");
	});

	it("非同前缀路由不误判激活（/admin/settings-x）", () => {
		setPath("/admin/settings-x");
		render(<NavMenu />);

		expect(getSettingsParent()?.className).not.toContain("before:bg-primary");
	});

	it("收起态点击父项弹出子菜单，子项导航后关闭", () => {
		setPath("/admin/settings/general");
		render(
			<TooltipProvider>
				<NavMenu collapsed />
			</TooltipProvider>,
		);

		const parent = getSettingsParent();
		// 收起态子路由命中 → 图标保持激活态
		expect(parent?.className).toContain("before:bg-primary");
		// 子项未展开前不在 DOM（内联渲染与 flyout 均未出现）
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBe(0);

		// 点击图标 → flyout 弹出，子项链接出现
		fireEvent.click(parent as HTMLElement);
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBeGreaterThan(0);
		expect(parent?.getAttribute("aria-expanded")).toBe("true");

		// 点击子项 → 导航并关闭 flyout
		fireEvent.click(screen.getByTestId("link-/admin/settings/general"));
		expect(parent?.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryAllByTestId("link-/admin/settings/general").length).toBe(0);
	});
});
