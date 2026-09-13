import { describe, expect, it } from "vitest";
import { NAV_MENU_ITEMS, type NavMenuItem } from "../nav-menu-config";

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
