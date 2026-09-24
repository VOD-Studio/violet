import { CHAPTERS, DesignSystemPage } from "@features/design-system/ui/DesignSystemPage";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routeTree } from "../../routeTree.gen";

/**
 * 装配后的路由实例把注册路径收在 options.id；沿 children 走一遍
 * 即得生成路由树的全量路径，用来对账导航配置指向的路由真实存在。
 */
function collectRouteIds(node: unknown, acc: Set<string> = new Set()): Set<string> {
	const n = node as { options?: { id?: unknown }; children?: unknown[] } | null;
	if (!n) return acc;
	if (typeof n.options?.id === "string") acc.add(n.options.id);
	for (const kid of n.children ?? []) collectRouteIds(kid, acc);
	return acc;
}

describe("/design-system 路由", () => {
	it("注册进生成的路由树", () => {
		expect(collectRouteIds(routeTree).has("/design-system")).toBe(true);
	});
});

describe("营造法式页", () => {
	it("渲染标题与箴言四字", () => {
		render(<DesignSystemPage />);
		expect(screen.getByRole("heading", { level: 1, name: "营造法式" })).toBeTruthy();
		for (const word of ["有效", "清晰", "准确", "美"]) {
			expect(screen.getByText(word)).toBeTruthy();
		}
	});

	it("菜单立全部章节，未落地章节标注营造中", () => {
		render(<DesignSystemPage />);
		for (const chapter of CHAPTERS) {
			expect(screen.getByRole("button", { name: new RegExp(chapter.name) })).toBeTruthy();
		}
		// 徽标数与章节数据中未落地章数对账；全部落地后为 0
		expect(screen.queryAllByText("营造中")).toHaveLength(
			CHAPTERS.filter((chapter) => !chapter.content).length,
		);
	});

	it("菜单切换章节，一次只呈一章", () => {
		render(<DesignSystemPage />);
		fireEvent.click(screen.getByRole("button", { name: /色板生成器/ }));
		expect(screen.getByRole("heading", { level: 2, name: "色板生成器" })).toBeTruthy();
		// 原章卸载：章头与箴言都不在
		expect(screen.queryByRole("heading", { level: 2, name: "设计原则" })).toBeNull();
		expect(screen.queryByText("有效")).toBeNull();
	});

	it("设计原则章成文：箴言柱脚与全站底线", () => {
		render(<DesignSystemPage />);
		expect(screen.getByText(/语义 token 优先/)).toBeTruthy();
		expect(screen.getByText(/WCAG AA 对比度/)).toBeTruthy();
		// 底线与布局规格章都会复述圆角红线，存在即成文
		expect(screen.getAllByText(/rounded-2xl/).length).toBeGreaterThan(0);
	});
});
