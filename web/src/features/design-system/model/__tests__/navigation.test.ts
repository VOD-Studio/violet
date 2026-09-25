import { describe, expect, it } from "vitest";
import {
	ALL_NAV_ITEMS,
	DESIGN_SYSTEM_NAV_GROUPS,
	findNavItemByPath,
	getSiblingNavItems,
} from "../navigation";

describe("设计系统导航模型", () => {
	it("各分组均包含非空项目且路径唯一", () => {
		expect(DESIGN_SYSTEM_NAV_GROUPS.length).toBeGreaterThanOrEqual(3);
		const paths = ALL_NAV_ITEMS.map((item) => item.to);
		const uniquePaths = new Set(paths);
		expect(uniquePaths.size).toBe(paths.length);
	});

	it("findNavItemByPath 支持精确匹配与缺省回退", () => {
		expect(findNavItemByPath("/design-system/palette").id).toBe("palette");
		expect(findNavItemByPath("/design-system/specimens/").id).toBe("specimens");
		expect(findNavItemByPath("/design-system/unknown-route").id).toBe(ALL_NAV_ITEMS[0].id);
	});

	it("getSiblingNavItems 正确计算首章、中章与尾章的相邻项", () => {
		const first = ALL_NAV_ITEMS[0];
		const firstSiblings = getSiblingNavItems(first.id);
		expect(firstSiblings.prev).toBeNull();
		expect(firstSiblings.next?.id).toBe(ALL_NAV_ITEMS[1].id);

		const middle = ALL_NAV_ITEMS[2];
		const middleSiblings = getSiblingNavItems(middle.id);
		expect(middleSiblings.prev?.id).toBe(ALL_NAV_ITEMS[1].id);
		expect(middleSiblings.next?.id).toBe(ALL_NAV_ITEMS[3].id);

		const last = ALL_NAV_ITEMS[ALL_NAV_ITEMS.length - 1];
		const lastSiblings = getSiblingNavItems(last.id);
		expect(lastSiblings.prev?.id).toBe(ALL_NAV_ITEMS[ALL_NAV_ITEMS.length - 2].id);
		expect(lastSiblings.next).toBeNull();
	});

	it("二级菜单项具备有效标题与目标路径", () => {
		const specimensItem = ALL_NAV_ITEMS.find((item) => item.id === "specimens");
		expect(specimensItem?.children).toBeDefined();
		expect(specimensItem?.children?.length).toBeGreaterThan(0);
		for (const sub of specimensItem?.children ?? []) {
			expect(sub.title).toBeTruthy();
			expect(sub.to).toMatch(/^\/design-system/);
		}
	});
});
