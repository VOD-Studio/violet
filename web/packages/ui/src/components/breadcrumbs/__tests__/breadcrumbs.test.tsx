import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Breadcrumbs } from "../breadcrumbs";

const ITEMS = [
	{ label: "内容", href: "/admin" },
	{ label: "文章", href: "/admin/posts" },
	{ label: "拆解 Saber —— 一个用 Go 写就的、会思考的聊天机器人" },
];

const LONG_ITEMS = [
	{ label: "项目", href: "/projects" },
	{ label: "Violet", href: "/projects/violet" },
	{ label: "设计稿", href: "/projects/violet/design" },
	{ label: "组件", href: "/projects/violet/design/components" },
	{ label: "组件库", href: "/projects/violet/design/components/ui" },
	{ label: "按钮" },
];

afterEach(cleanup);

describe("Breadcrumbs", () => {
	it("用 nav + ol 表达层级，最后一级是当前页且不是链接", () => {
		render(<Breadcrumbs items={ITEMS} />);
		const nav = screen.getByRole("navigation", { name: "当前位置" });
		expect(nav.querySelector("ol")).toBeTruthy();
		const links = within(nav).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["内容", "文章"]);
		expect(links[0]?.getAttribute("href")).toBe("/admin");
		expect(links[1]?.getAttribute("href")).toBe("/admin/posts");
		const current = screen.getByText(ITEMS[2].label);
		expect(current.tagName).toBe("SPAN");
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(screen.queryByRole("link", { name: ITEMS[2].label })).toBeNull();
	});

	it("分隔符对读屏隐藏，当前页保留完整名称供悬停查看", () => {
		const { container } = render(<Breadcrumbs items={ITEMS} />);
		const separators = container.querySelectorAll(".v-breadcrumbs__separator");
		expect(separators).toHaveLength(2);
		for (const separator of separators) {
			expect(separator.getAttribute("aria-hidden")).toBe("true");
		}
		expect(screen.getByText(ITEMS[2].label).getAttribute("title")).toBe(ITEMS[2].label);
	});

	it("超过四级时中间折进菜单，第一级与最后两级保留", async () => {
		render(<Breadcrumbs items={LONG_ITEMS} />);
		const nav = screen.getByRole("navigation", { name: "当前位置" });
		expect(within(nav).getByRole("link", { name: "项目" })).toBeTruthy();
		expect(within(nav).getByRole("link", { name: "组件库" })).toBeTruthy();
		expect(within(nav).getByText("按钮")).toBeTruthy();
		expect(within(nav).queryByRole("link", { name: "Violet" })).toBeNull();

		const more = screen.getByRole("button", { name: "展开中间的 3 级" });
		expect(more.getAttribute("aria-expanded")).toBe("false");
		fireEvent.pointerDown(more, { button: 0, ctrlKey: false, pointerType: "mouse" });
		const menu = await screen.findByRole("menu");
		expect(menu).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "Violet" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "设计稿" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "组件" })).toBeTruthy();
	});

	it("窄屏返回链接指向上一级", () => {
		render(<Breadcrumbs items={ITEMS} />);
		const back = document.querySelector<HTMLAnchorElement>(".v-breadcrumbs__back");
		expect(back).not.toBeNull();
		expect(back?.getAttribute("href")).toBe("/admin/posts");
		expect(back?.textContent).toBe("文章");
	});

	it("没有目标或没有上一级时不渲染多余链接", () => {
		render(<Breadcrumbs items={[{ label: "只有当前页" }]} />);
		expect(screen.queryAllByRole("link")).toHaveLength(0);
		expect(document.querySelector(".v-breadcrumbs__back")).toBeNull();
	});
});
