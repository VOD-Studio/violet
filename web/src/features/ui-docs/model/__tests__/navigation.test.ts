import { describe, expect, it } from "vitest";
import { CATALOG_GUIDES, COMPONENT_DOCS } from "../guides";
import {
	ALL_NAV_ITEMS,
	findNavItemByPath,
	getSiblingNavItems,
	UI_DOCS_NAV_GROUPS,
} from "../navigation";

describe("组件库文档导航", () => {
	it("分组与页面路径唯一，指南和组件均进入目录", () => {
		expect(UI_DOCS_NAV_GROUPS.map((group) => group.title)).toEqual([
			"入门",
			"主题与样式",
			"组件",
			"开发",
			"智能体",
		]);
		const paths = ALL_NAV_ITEMS.map((item) => item.to);
		expect(new Set(paths).size).toBe(paths.length);
		expect(CATALOG_GUIDES).toHaveLength(16);
		expect(COMPONENT_DOCS.map((item) => item.id)).toEqual([
			"button",
			"badge",
			"checkbox",
			"dialog",
			"tabs",
			"input",
			"text-field",
		]);
	});

	it("精确匹配指南、组件和末尾斜杠，未知页面回退到介绍", () => {
		expect(findNavItemByPath("/ui/guides/theming").id).toBe("theming");
		expect(findNavItemByPath("/ui/components/").id).toBe("components");
		expect(findNavItemByPath("/ui/components/button").id).toBe("button");
		expect(findNavItemByPath("/ui/components/buttonish").id).toBe("introduction");
	});

	it("分页覆盖指南和组件，首尾页没有越界链接", () => {
		const first = getSiblingNavItems(ALL_NAV_ITEMS[0].id);
		expect(first.prev).toBeNull();
		expect(first.next?.id).toBe(ALL_NAV_ITEMS[1].id);

		const button = getSiblingNavItems("button");
		expect(button.prev?.id).toBe("components");
		expect(button.next?.id).toBe("badge");

		const last = getSiblingNavItems(ALL_NAV_ITEMS.at(-1)?.id ?? "");
		expect(last.prev?.id).toBe(ALL_NAV_ITEMS.at(-2)?.id);
		expect(last.next).toBeNull();
		expect(getSiblingNavItems("unknown")).toEqual({ prev: null, next: null });
	});
});
