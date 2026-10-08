import { describe, expect, it } from "vitest";
import { ALL_NAV_ITEMS, findNavItemByPath, getSiblingNavItems } from "../navigation";

describe("组件库文档导航", () => {
	it("页面路径不会互相覆盖", () => {
		const paths = ALL_NAV_ITEMS.map((item) => item.to);
		expect(new Set(paths).size).toBe(paths.length);
	});

	it("精确匹配指南、组件和末尾斜杠，未知页面回退到介绍", () => {
		expect(findNavItemByPath("/ui/guides/theming").id).toBe("theming");
		expect(findNavItemByPath("/ui/components/").id).toBe("components");
		expect(findNavItemByPath("/ui/components/button").id).toBe("button");
		expect(findNavItemByPath("/ui/components/image-pixel-reveal").id).toBe(
			"image-pixel-reveal",
		);
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
