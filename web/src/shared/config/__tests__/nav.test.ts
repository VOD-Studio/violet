import { describe, expect, it } from "vitest";
import { NAV_ITEMS, type NavRouteItem } from "../nav";

describe("NAV_ITEMS 组件库入口", () => {
	const uiDocs = NAV_ITEMS.find(
		(item): item is NavRouteItem => item.type === "route" && item.to === "/ui",
	);

	it("更多菜单提供组件库文档入口", () => {
		expect(uiDocs?.label).toBe("组件库");
		expect(uiDocs?.description).toBe("查阅 violet/ui 组件用法与开发文档");
		expect(uiDocs?.primary).toBeFalsy();
	});
});
