import type { NavItem } from "@shared/config/nav";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Home, Info } from "lucide-react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteIsland, type SiteIslandProps } from "../SiteIsland";

const items: NavItem[] = [
	{ label: "首页", description: "首页", to: "/", icon: Home },
	{ label: "关于", description: "关于", to: "/about", icon: Info },
];

function PlainLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <a href={href} {...props} />;
}

function renderIsland(props: Partial<SiteIslandProps> = {}) {
	const handlers = {
		onOpenChange: vi.fn(),
		onCompactChange: vi.fn(),
		onSelect: vi.fn(),
	};
	const view = render(
		<SiteIsland
			items={items}
			activeTo="/about"
			open={false}
			compact={false}
			viewportWidth={390}
			routing={null}
			LinkComponent={PlainLink}
			{...handlers}
			{...props}
		/>,
	);
	return { ...handlers, ...view };
}

describe("SiteIsland", () => {
	afterEach(cleanup);

	it("收起态：入口链接来自 items，当前项带 aria-current，「更多」触发展开", () => {
		const { onOpenChange } = renderIsland();
		const home = screen.getByRole("link", { name: "首页" });
		expect(home.getAttribute("href")).toBe("/");
		const about = screen.getByRole("link", { name: "关于" });
		expect(about.getAttribute("href")).toBe("/about");
		expect(about.getAttribute("aria-current")).toBe("page");
		expect(about.textContent).toContain("关于");
		fireEvent.click(screen.getByRole("button", { name: "展开全部导航" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	it("open 时显示面板、插槽内容；Esc 与「收起导航」都触发关闭", () => {
		const { onOpenChange } = renderIsland({
			open: true,
			themePicker: <div>主题插槽</div>,
			presence: {
				activityText: "正在播放 晴天",
				renderTicker: () => <span>ticker</span>,
				card: <div>此刻卡片</div>,
			},
		});
		expect(screen.getByText("Violet · 浏览本站")).toBeTruthy();
		expect(screen.getByText("主题插槽")).toBeTruthy();
		expect(screen.getByText("此刻卡片")).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onOpenChange).toHaveBeenCalledWith(false);
		onOpenChange.mockClear();
		const closers = screen.getAllByRole("button", { name: "收起导航" });
		fireEvent.click(closers[closers.length - 1]);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("compact 时只有「展开导航」圆钮，点它请求取消收起", () => {
		const { onCompactChange } = renderIsland({ compact: true });
		expect(screen.queryByRole("link", { name: "首页" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
		expect(onCompactChange).toHaveBeenCalledWith(false);
	});

	it("compact 且有 presence 时圆钮显示活动并展开面板", () => {
		const { onOpenChange } = renderIsland({
			compact: true,
			presence: {
				activityText: "正在播放 晴天",
				renderTicker: () => <span>ticker</span>,
				card: null,
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "此刻正在播放 晴天，展开详情与导航" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	it("routing 为数值时显示页面加载进度线", () => {
		renderIsland({ routing: 40 });
		expect(screen.getByRole("progressbar", { name: "页面加载" })).toBeTruthy();
	});

	it("仅左键且无修饰键的点击触发 onSelect", () => {
		const { onSelect } = renderIsland();
		const home = screen.getByRole("link", { name: "首页" });
		fireEvent.click(home, { metaKey: true });
		fireEvent.click(home, { button: 1 });
		expect(onSelect).not.toHaveBeenCalled();
		fireEvent.click(home);
		expect(onSelect).toHaveBeenCalledWith("/");
	});

	it("placement=container 时根容器不 fixed", () => {
		const { container } = renderIsland({ placement: "container" });
		const root = container.firstElementChild as HTMLElement;
		expect(root.className).not.toContain("fixed");
		expect(root.className).toContain("absolute");
	});
});
