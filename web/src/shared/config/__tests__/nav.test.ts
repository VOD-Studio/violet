import { describe, expect, it } from "vitest";
import { NAV_ITEMS, type NavRouteItem } from "../nav";

describe("NAV_ITEMS 营造法式入口", () => {
	const codex = NAV_ITEMS.find(
		(item): item is NavRouteItem => item.type === "route" && item.to === "/design-system",
	);

	it("「更多」菜单收录营造法式入口", () => {
		expect(codex).toBeTruthy();
	});

	it("标签遵循站点命名惯例：诗意中文标签配英文路由", () => {
		expect(codex?.label).toBe("营造法式");
	});

	it("入口为 secondary，不占主导航位", () => {
		expect(codex?.primary).toBeFalsy();
	});

	it("描述成文，说明页面是什么", () => {
		expect(codex?.description.trim().length).toBeGreaterThan(0);
	});
});
