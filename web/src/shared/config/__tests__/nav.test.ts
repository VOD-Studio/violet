import { describe, expect, it } from "vitest";
import { flattenNavLinks, getNavItems, resolveActiveNav } from "../nav";

const labels = (authenticated: boolean) => getNavItems({ authenticated }).map((item) => item.label);

describe("getNavItems 一级入口", () => {
	it("游客：首页、博客、手记、推文、更多", () => {
		expect(labels(false)).toEqual(["首页", "博客", "手记", "推文", "更多"]);
	});

	it("登录后聊天成为一级入口，位于推文与更多之间", () => {
		expect(labels(true)).toEqual(["首页", "博客", "手记", "推文", "聊天", "更多"]);
	});

	it("手记指向现有 /notes", () => {
		const journal = getNavItems({ authenticated: false }).find((item) => item.label === "手记");
		expect(journal?.to).toBe("/notes");
	});

	it("聊天不再藏在更多里", () => {
		const more = getNavItems({ authenticated: true }).find((item) => item.label === "更多");
		expect(more?.children?.some((link) => link.to === "/chat")).toBe(false);
	});

	it("更多收纳项目与图集，不再收纳系列", () => {
		const more = getNavItems({ authenticated: false }).find((item) => item.label === "更多");
		expect(more?.to).toBeUndefined();
		const targets = more?.children?.map((link) => link.to);
		expect(targets).toEqual(expect.arrayContaining(["/projects", "/galleries"]));
		expect(targets).not.toContain("/blog/series");
	});

	it("博客依次提供文章、系列、归档三个路径入口", () => {
		const blog = getNavItems({ authenticated: false }).find((item) => item.label === "博客");
		expect(blog?.children?.map(({ label, to }) => ({ label, to }))).toEqual([
			{ label: "文章", to: "/blog" },
			{ label: "系列", to: "/blog/series" },
			{ label: "归档", to: "/blog/archive" },
		]);
	});
});

describe("NAV_ITEMS 看板入口", () => {
	it("更多菜单提供看板文档与演示入口，/kanban 归它", () => {
		const items = getNavItems({ authenticated: false });
		const more = items.find((item) => item.label === "更多");
		expect(more?.children?.find((link) => link.to === "/kanban")?.label).toBe("看板");
		expect(resolveActiveNav("/kanban", items)?.link.label).toBe("看板");
	});
});

describe("resolveActiveNav", () => {
	const items = getNavItems({ authenticated: true });

	it("详情页仍归属其列表项", () => {
		const active = resolveActiveNav("/blog/my-first-post", items);
		expect(active?.item.label).toBe("博客");
		expect(active?.link.to).toBe("/blog");
	});

	it("按路径区分归档，筛选和分页不改变当前项", () => {
		const active = resolveActiveNav("/blog/archive?source=original&tag=go&page=2#2026", items);
		expect(active?.item.label).toBe("博客");
		expect(active?.link.label).toBe("归档");
	});

	it("等长命中时二级项优先，列表页标记「文章」", () => {
		expect(resolveActiveNav("/blog", items)?.link.label).toBe("文章");
	});

	it("系列视图与系列详情都归属系列入口", () => {
		for (const href of ["/blog/series?source=original&tag=go&page=2", "/blog/series/go-book"]) {
			const active = resolveActiveNav(href, items);
			expect(active?.item.label).toBe("博客");
			expect(active?.link.label).toBe("系列");
			expect(active?.link.to).toBe("/blog/series");
		}
	});

	it("文章列表与文章详情按路径归属文章，筛选不改变当前项", () => {
		expect(resolveActiveNav("/blog?source=repost&tag=go&page=2", items)?.link.label).toBe(
			"文章",
		);
		expect(resolveActiveNav("/blog/article?source=original", items)?.link.label).toBe("文章");
	});

	it("手记详情页归属手记", () => {
		const active = resolveActiveNav("/notes/12", items);
		expect(active?.item.label).toBe("手记");
		expect(active?.link.to).toBe("/notes");
	});

	it("更多里的子页归属更多分组", () => {
		const active = resolveActiveNav("/projects", items);
		expect(active?.item.label).toBe("更多");
		expect(active?.link.label).toBe("项目");
	});

	it("聊天子页归属聊天一级入口", () => {
		expect(resolveActiveNav("/chat/personas", items)?.item.label).toBe("聊天");
	});

	it("首页只精确命中", () => {
		expect(resolveActiveNav("/", items)?.item.label).toBe("首页");
		expect(resolveActiveNav("/profile", items)).toBeNull();
	});

	it("前缀按路径段匹配，/blogging 不属于 /blog", () => {
		expect(resolveActiveNav("/blogging", items)).toBeNull();
	});
});

describe("flattenNavLinks", () => {
	it("目标不重复，且包含二级项", () => {
		const targets = flattenNavLinks(getNavItems({ authenticated: true })).map(
			(link) => link.to,
		);
		expect(new Set(targets).size).toBe(targets.length);
		expect(targets).toContain("/blog/archive");
		expect(targets).toContain("/blog/series");
		expect(flattenNavLinks().find((link) => link.to === "/blog")?.label).toBe("文章");
		expect(targets).toContain("/kanban");
	});
});
