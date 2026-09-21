import { DesignSystemPage } from "@features/design-system/ui/DesignSystemPage";
import { render, screen } from "@testing-library/react";
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

	it("七章节骨架齐备，未落地六章标注营造中", () => {
		render(<DesignSystemPage />);
		for (const name of [
			"快速决策表",
			"色板生成器",
			"token 词典",
			"布局规格",
			"组件活样例",
			"动效章程",
		]) {
			expect(screen.getByRole("heading", { name })).toBeTruthy();
		}
		expect(screen.getAllByText("营造中")).toHaveLength(6);
	});

	it("设计原则章成文：箴言柱脚与全站底线", () => {
		render(<DesignSystemPage />);
		expect(screen.getByText(/语义 token 优先/)).toBeTruthy();
		expect(screen.getByText(/WCAG AA 对比度/)).toBeTruthy();
		expect(screen.getByText(/rounded-2xl/)).toBeTruthy();
	});
});
