import { describe, expect, it } from "vitest";
import { flattenNavLinks, NAV_ITEMS, resolveActiveNav } from "../nav";

describe("NAV_ITEMS 组件库入口", () => {
	const more = NAV_ITEMS.find((item) => item.label === "更多");
	const uiDocs = more?.children?.find((link) => link.to === "/ui");

	it("更多菜单提供组件库文档入口", () => {
		expect(more?.to).toBeUndefined();
		expect(uiDocs?.label).toBe("组件库");
		expect(uiDocs?.description).toBe("查阅 violet/ui 组件用法与开发文档");
	});
});

describe("resolveActiveNav", () => {
	it("详情页仍归属其列表项", () => {
		const active = resolveActiveNav("/blog/my-first-post");
		expect(active?.item.label).toBe("博客");
		expect(active?.link.to).toBe("/blog");
	});

	it("取最长命中：归档不被博客吞掉", () => {
		const active = resolveActiveNav("/blog/archive");
		expect(active?.item.label).toBe("博客");
		expect(active?.link.label).toBe("归档");
	});

	it("等长命中时二级项优先，列表页标记「全部文章」", () => {
		expect(resolveActiveNav("/blog")?.link.label).toBe("全部文章");
	});

	it("二级项命中时归属其父分组", () => {
		const active = resolveActiveNav("/notes/12");
		expect(active?.item.label).toBe("更多");
		expect(active?.link.label).toBe("笔记");
	});

	it("首页只精确命中", () => {
		expect(resolveActiveNav("/")?.item.label).toBe("首页");
		expect(resolveActiveNav("/profile")).toBeNull();
	});

	it("前缀按路径段匹配，/blogging 不属于 /blog", () => {
		expect(resolveActiveNav("/blogging")).toBeNull();
	});
});

describe("flattenNavLinks", () => {
	it("目标不重复，且包含二级项", () => {
		const targets = flattenNavLinks().map((link) => link.to);
		expect(new Set(targets).size).toBe(targets.length);
		expect(targets).toContain("/blog/archive");
		expect(targets).toContain("/ui");
	});
});
