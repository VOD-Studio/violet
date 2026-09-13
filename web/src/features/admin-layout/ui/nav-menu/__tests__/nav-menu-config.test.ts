import { describe, expect, it } from "vitest";
import { NAV_MENU_ITEMS, type NavMenuItem, resolveNavTitle } from "../nav-menu-config";

/** 深度收集菜单树全部图标名（lucide 组件以 displayName 暴露图标名） */
const collectIconNames = (items: NavMenuItem[]): string[] =>
	items.flatMap((item) => [
		item.icon.displayName ?? "",
		...(item.children ? collectIconNames(item.children) : []),
	]);

describe("nav-menu-config", () => {
	it("全菜单图标不重复", () => {
		const names = collectIconNames(NAV_MENU_ITEMS);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe("resolveNavTitle", () => {
	it("子路由标题不被同前缀父项吞掉", () => {
		// /admin/settings 前缀覆盖全部设置子页；子项精确匹配必须先行
		expect(resolveNavTitle("/admin/settings/profile")).toBe("关于");
		expect(resolveNavTitle("/admin/settings/github")).toBe("GitHub");
		expect(resolveNavTitle("/admin/settings/startup")).toBe("启动配置");
		expect(resolveNavTitle("/admin/mcp")).toBe("MCP 接入");
	});

	it("顶级项精确命中与前缀命中", () => {
		expect(resolveNavTitle("/admin")).toBe("概览");
		expect(resolveNavTitle("/admin/posts/abc")).toBe("文章管理");
		expect(resolveNavTitle("/other")).toBe("后台管理");
	});
});
