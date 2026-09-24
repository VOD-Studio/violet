import { ALL_NAV_ITEMS } from "@features/design-system/model/navigation";
import {
	DecisionsPage,
	LayoutPage,
	MotionPage,
	PalettePage,
	PrinciplesPage,
	SpecimensButtonsPage,
	SpecimensFeedbackPage,
	SpecimensPage,
	SpecimensStatusPage,
	TokensPage,
} from "@features/design-system/ui/pages";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routeTree } from "../../routeTree.gen";

/**
 * 遍历生成的路由树收集全量路由路径，用来对账导航配置指向的路由真实存在。
 */
function collectRoutePaths(
	node: unknown,
	parentPath = "",
	acc: Set<string> = new Set(),
): Set<string> {
	const n = node as {
		options?: { id?: string; path?: string };
		path?: string;
		fullPath?: string;
		children?: unknown;
	} | null;
	if (!n) return acc;

	const rawPath = n.options?.path ?? n.path ?? n.options?.id ?? "";
	let currentPath = parentPath;
	if (rawPath) {
		if (rawPath === "/") {
			currentPath = parentPath || "/";
		} else if (rawPath.startsWith("/")) {
			currentPath =
				parentPath && parentPath !== "/"
					? `${parentPath}${rawPath}`.replace(/\/+/g, "/")
					: rawPath;
		} else {
			currentPath = `${parentPath}/${rawPath}`.replace(/\/+/g, "/");
		}
	}

	if (currentPath) acc.add(currentPath);
	if (n.fullPath) acc.add(n.fullPath);
	if (n.options?.id) acc.add(n.options.id);

	const kids = Array.isArray(n.children)
		? n.children
		: n.children && typeof n.children === "object"
			? Object.values(n.children)
			: [];

	for (const kid of kids) {
		collectRoutePaths(kid, currentPath, acc);
	}
	return acc;
}

describe("/design-system 多路由体系", () => {
	it("父路由、一级章节与全部二级子路由均注册进路由树", () => {
		const routePaths = collectRoutePaths(routeTree);
		expect(routePaths.has("/design-system")).toBe(true);

		for (const item of ALL_NAV_ITEMS) {
			expect(routePaths.has(item.to)).toBe(true);
			for (const sub of item.children ?? []) {
				expect(routePaths.has(sub.to)).toBe(true);
			}
		}
	});
});

describe("各章节子页成文渲染", () => {
	it("设计原则章渲染箴言四字与全站底线", () => {
		render(<PrinciplesPage />);
		expect(screen.getByRole("heading", { level: 2, name: "设计原则" })).toBeTruthy();
		for (const word of ["有效", "清晰", "准确", "美"]) {
			expect(screen.getByText(word)).toBeTruthy();
		}
		expect(screen.getByText(/语义 token 优先/)).toBeTruthy();
		expect(screen.getByText(/WCAG AA 对比度/)).toBeTruthy();
	});

	it("快速决策表章正常渲染", () => {
		render(<DecisionsPage />);
		expect(screen.getByRole("heading", { level: 2, name: "快速决策表" })).toBeTruthy();
	});

	it("色板生成器章正常渲染", () => {
		render(<PalettePage />);
		expect(screen.getByRole("heading", { level: 2, name: "色板生成器" })).toBeTruthy();
	});

	it("Token 词典章正常渲染", () => {
		render(<TokensPage />);
		expect(screen.getByRole("heading", { level: 2, name: "Token 词典" })).toBeTruthy();
	});

	it("布局规格章正常渲染", () => {
		render(<LayoutPage />);
		expect(screen.getByRole("heading", { level: 2, name: "布局规格" })).toBeTruthy();
	});

	it("动效章程章正常渲染", () => {
		render(<MotionPage />);
		expect(screen.getByRole("heading", { level: 2, name: "动效章程" })).toBeTruthy();
	});

	it("组件活样例章全量正常渲染", () => {
		render(<SpecimensPage />);
		expect(screen.getByRole("heading", { level: 2, name: "组件活样例" })).toBeTruthy();
	});

	it("组件活样例二级子路由（按钮、徽标、输入）专项正常渲染", () => {
		const { unmount: u1 } = render(<SpecimensButtonsPage />);
		expect(screen.getByRole("heading", { level: 2, name: "按钮与控件" })).toBeTruthy();
		u1();

		const { unmount: u2 } = render(<SpecimensStatusPage />);
		expect(screen.getByRole("heading", { level: 2, name: "徽标与状态" })).toBeTruthy();
		u2();

		render(<SpecimensFeedbackPage />);
		expect(screen.getByRole("heading", { level: 2, name: "输入与交互" })).toBeTruthy();
	});
});
