import { getNavItems, type NavItem, resolveActiveNav } from "@shared/config/nav";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteNavbar, type SiteNavbarProps } from "../SiteNavbar";

/** 测试用的普通锚点：同时验证 LinkComponent 注入契约（href、ref 与其余属性透传）。 */
function PlainLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <a href={href} {...props} />;
}

function setup(overrides: Partial<SiteNavbarProps> & { path?: string; authenticated?: boolean }) {
	const { path = "/", authenticated = true, ...rest } = overrides;
	const items: NavItem[] = getNavItems({ authenticated });
	const onSearch = vi.fn();
	render(
		<SiteNavbar
			items={items}
			active={resolveActiveNav(path, items)}
			logo={<span>左药丸内容</span>}
			actions={<span>右药丸内容</span>}
			onSearch={onSearch}
			LinkComponent={PlainLink}
			{...rest}
		/>,
	);
	return { onSearch, nav: screen.getByRole("navigation", { name: "主导航" }) };
}

const segments = (nav: HTMLElement) =>
	Array.from(nav.querySelectorAll<HTMLElement>("[data-segment-item]"));

describe("SiteNavbar", () => {
	afterEach(cleanup);

	it("常规态：一级入口依次排开，当前项标为 current，搜索在末尾", () => {
		const { nav } = setup({ path: "/blog" });
		expect(segments(nav).map((item) => item.textContent)).toEqual([
			"首页",
			"博客",
			"手记",
			"推文",
			"聊天",
			"更多",
		]);
		expect(within(nav).getByRole("link", { name: "博客" }).getAttribute("aria-current")).toBe(
			"page",
		);
		expect(within(nav).getByRole("link", { name: "手记" }).getAttribute("aria-current")).toBe(
			null,
		);
		const search = within(nav).getByRole("button", { name: /^搜索/ });
		const group = nav.querySelector<HTMLElement>('[data-slot="segmented"]') as HTMLElement;
		expect(
			group.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("入口链接经 LinkComponent 渲染，目标取自导航数据", () => {
		const { nav } = setup({});
		expect(within(nav).getByRole("link", { name: "手记" }).getAttribute("href")).toBe("/notes");
		expect(within(nav).getByRole("link", { name: "聊天" }).getAttribute("href")).toBe("/chat");
	});

	it("游客没有聊天入口", () => {
		const { nav } = setup({ authenticated: false });
		expect(within(nav).queryByRole("link", { name: "聊天" })).toBeNull();
	});

	it("点搜索触发 onSearch，并提示快捷键", () => {
		const { nav, onSearch } = setup({});
		const search = within(nav).getByRole("button", { name: /^搜索/ });
		expect(search.querySelector("kbd")).not.toBeNull();
		fireEvent.click(search);
		expect(onSearch).toHaveBeenCalledTimes(1);
	});

	it("详情态：当前项展开成「栏目 / 标题」，其余项收为带提示的图标", () => {
		const { nav } = setup({ path: "/blog/hello", title: "派早报：荣耀发布" });
		const group = nav.querySelector<HTMLElement>('[data-slot="segmented"]');
		expect(group?.dataset.expanded).toBe("true");
		const current = segments(nav).find((item) => item.dataset.active === "true");
		expect(current?.textContent).toBe("博客 / 派早报：荣耀发布");
		const others = segments(nav).filter((item) => item.dataset.active === "false");
		expect(others).toHaveLength(5);
		for (const item of others) expect(item.getAttribute("title")).toBeTruthy();
	});

	it("阅读进度只在详情态出现，宽度取自 readingProgress，且不进入无障碍树", () => {
		const { nav } = setup({ path: "/blog", readingProgress: 30 });
		expect(nav.querySelector('[data-slot="reading-progress"]')).toBeNull();
		cleanup();

		const detail = setup({ path: "/blog/hello", title: "标题", readingProgress: 30 }).nav;
		const bar = detail.querySelector<HTMLElement>('[data-slot="reading-progress"]');
		expect(bar?.getAttribute("aria-hidden")).toBe("true");
		expect(bar?.firstElementChild?.getAttribute("style")).toContain("width: 30%");
	});

	it("更多里的子页：更多的位置直接换成子页名并选中", () => {
		const { nav } = setup({ path: "/projects" });
		const current = segments(nav).find((item) => item.dataset.active === "true");
		expect(current?.textContent).toBe("项目");
		expect(segments(nav).at(-1)).toBe(current);
	});

	it("收起后更多里的子页也只剩图标，分组按钮仍有名称并标为当前", () => {
		const { nav } = setup({ path: "/projects", collapsed: true });
		const current = within(nav).getByRole("button", { name: "更多" });
		expect(current.textContent).toBe("");
		expect(current.getAttribute("aria-current")).toBe("page");
	});

	it("页面加载进度线：有值才出现，值与读屏数值一致", () => {
		setup({ routing: null });
		expect(screen.queryByRole("progressbar", { name: "页面加载" })).toBeNull();
		cleanup();

		setup({ routing: 42 });
		expect(
			screen.getByRole("progressbar", { name: "页面加载" }).getAttribute("aria-valuenow"),
		).toBe("42");
	});

	it("收起态：入口只剩图标且仍有名称，右药丸不可交互，搜索收成图标", () => {
		const { nav } = setup({ path: "/blog", collapsed: true });
		const root = nav.closest<HTMLElement>('[data-slot="site-navbar"]');
		expect(root?.dataset.collapsed).toBe("true");
		expect(screen.getByText("右药丸内容").closest("[inert]")).not.toBeNull();
		expect(screen.getByText("左药丸内容").closest("[inert]")).toBeNull();
		// 当前项没有标题可显示：只剩图标，名称由 aria-label 提供
		const current = within(nav).getByRole("link", { name: "博客" });
		expect(current.textContent).toBe("");
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(within(nav).getByRole("button", { name: /^搜索/ }).dataset.compact).toBe("true");
	});

	it("展开态右药丸可交互", () => {
		setup({});
		expect(screen.getByText("右药丸内容").closest("[inert]")).toBeNull();
	});
});
