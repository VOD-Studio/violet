import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileCard, type ProfileCardProps } from "../ProfileCard";

function PlainLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return (
		<a
			href={href}
			{...props}
			onClick={(event) => {
				props.onClick?.(event);
				event.preventDefault();
			}}
		/>
	);
}

const base: ProfileCardProps = {
	identity: { name: "xunrua", bio: "写代码的人，也写字。" },
	year: { year: 2026, dayOfYear: 304, daysLeft: 61, month: 9 },
	LinkComponent: PlainLink,
};

function setup(props: Partial<ProfileCardProps> = {}) {
	return render(<ProfileCard {...base} {...props} />);
}

const media = {
	sourceLabel: "正在播放 · 网易云音乐",
	title: "晴天",
	subtitle: "周杰伦 · 叶惠美",
};

describe("ProfileCard", () => {
	afterEach(cleanup);

	it("身份行：名字与一句话", () => {
		setup();
		expect(screen.getByText("xunrua")).toBeTruthy();
		expect(screen.getByText("写代码的人，也写字。")).toBeTruthy();
	});

	it("没有 now：没有「此刻」区", () => {
		setup();
		expect(screen.queryByRole("region", { name: "此刻" })).toBeNull();
		expect(screen.queryByText("此刻")).toBeNull();
	});

	it("now 里既无 media 又无 app：整块「此刻」不出现", () => {
		setup({ now: { deviceName: "MacBook Pro" } });
		expect(screen.queryByRole("region", { name: "此刻" })).toBeNull();
		expect(screen.queryByText("MacBook Pro")).toBeNull();
	});

	it("有 media：显示设备、来源、歌名、副标题与进度槽", () => {
		setup({
			now: {
				deviceName: "MacBook Pro",
				media: { ...media, progress: <span>进度槽内容</span> },
			},
		});
		const now = screen.getByRole("region", { name: "此刻" });
		expect(within(now).getByText("MacBook Pro")).toBeTruthy();
		expect(within(now).getByText("正在播放 · 网易云音乐")).toBeTruthy();
		expect(within(now).getByText("晴天")).toBeTruthy();
		expect(within(now).getByText("周杰伦 · 叶惠美")).toBeTruthy();
		expect(within(now).getByText("进度槽内容")).toBeTruthy();
	});

	it("media 没有 progress：不显示进度槽", () => {
		setup({ now: { deviceName: "MacBook Pro", media } });
		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("暂停的封面灰化变淡；封面缺省时尺寸不变的占位仍在", () => {
		const { container } = setup({
			now: { deviceName: "Mac", media: { ...media, paused: true, cover: "/c.png" } },
		});
		const cover = container.querySelector<HTMLElement>('[data-slot="profile-cover"]');
		expect(cover?.className).toContain("grayscale");
		expect(cover?.className).toContain("opacity-60");
		expect(cover?.querySelector("img")?.getAttribute("src")).toBe("/c.png");
		cleanup();
		const { container: bare } = setup({ now: { deviceName: "Mac", media } });
		const placeholder = bare.querySelector<HTMLElement>('[data-slot="profile-cover"]');
		expect(placeholder).toBeTruthy();
		expect(placeholder?.querySelector("img")).toBeNull();
	});

	it("应用行：应用名与窗口标题、使用时长；usage 缺省时不渲染而应用名仍在", () => {
		const app = { name: "Zed", detail: "presence-card.tsx — violet" };
		setup({ now: { deviceName: "Mac", app: { ...app, usage: "1 时 20 分" } } });
		expect(screen.getByText("正在使用")).toBeTruthy();
		expect(screen.getByText("Zed")).toBeTruthy();
		expect(screen.getByText("presence-card.tsx — violet")).toBeTruthy();
		expect(screen.getByText("1 时 20 分")).toBeTruthy();
		cleanup();
		setup({ now: { deviceName: "Mac", app } });
		expect(screen.getByText("Zed")).toBeTruthy();
		expect(screen.queryByText("1 时 20 分")).toBeNull();
	});

	it("只有应用没有歌也显示「此刻」", () => {
		setup({ now: { deviceName: "Mac", app: { name: "Zed" } } });
		expect(screen.getByRole("region", { name: "此刻" })).toBeTruthy();
		expect(screen.queryByText("正在播放 · 网易云音乐")).toBeNull();
	});

	it("最新两条：各自带标签、日期与标题，链接指向各自地址", () => {
		setup({
			latest: {
				post: { title: "测试发送", date: "10.10", href: "/blog/test" },
				note: { title: "实时状态接入，发布 2.22.1", date: "10.29", href: "/notes/1" },
			},
		});
		const post = screen.getByRole("link", { name: /新文章/ });
		expect(post.getAttribute("href")).toBe("/blog/test");
		expect(within(post).getByText("10.10")).toBeTruthy();
		expect(within(post).getByText("测试发送")).toBeTruthy();
		const note = screen.getByRole("link", { name: /新手记/ });
		expect(note.getAttribute("href")).toBe("/notes/1");
		expect(within(note).getByText("实时状态接入，发布 2.22.1")).toBeTruthy();
		expect(post.parentElement?.className).toContain("grid-cols-2");
	});

	it("最新只有一条：独占一行；两条都缺：整行不出现", () => {
		setup({ latest: { note: { title: "只有手记", date: "10.29", href: "/notes/1" } } });
		const note = screen.getByRole("link", { name: /新手记/ });
		expect(screen.queryByRole("link", { name: /新文章/ })).toBeNull();
		expect(note.parentElement?.className).toContain("grid-cols-1");
		expect(note.parentElement?.className).not.toContain("grid-cols-2");
		cleanup();
		setup({ latest: {} });
		expect(screen.queryByRole("link", { name: /新文章|新手记/ })).toBeNull();
	});

	it("年度进度：文字对读屏可见，格子条隐藏", () => {
		const { container } = setup();
		expect(screen.getByText("2026 · 第 304 天")).toBeTruthy();
		expect(screen.getByText("还有 61 天")).toBeTruthy();
		const cells = container.querySelector('[data-slot="profile-months"]');
		expect(cells?.getAttribute("aria-hidden")).toBe("true");
		expect(cells?.children).toHaveLength(12);
	});

	it("入口三链指向关于、人设与友链", () => {
		setup();
		expect(screen.getByRole("link", { name: "关于我" }).getAttribute("href")).toBe("/about");
		expect(screen.getByRole("link", { name: "人设" }).getAttribute("href")).toBe("/persona");
		expect(screen.getByRole("link", { name: "友链" }).getAttribute("href")).toBe("/friends");
	});

	it("点站内链接触发 onNavigate", () => {
		const onNavigate = vi.fn();
		setup({
			onNavigate,
			latest: { post: { title: "测试发送", date: "10.10", href: "/blog/test" } },
		});
		fireEvent.click(screen.getByRole("link", { name: "友链" }));
		fireEvent.click(screen.getByRole("link", { name: /新文章/ }));
		expect(onNavigate).toHaveBeenCalledTimes(2);
	});

	it("GitHub 与 RSS 是外链新窗口；缺 href 就不渲染对应按钮", () => {
		setup({
			identity: {
				name: "xunrua",
				githubHref: "https://github.com/xunrua",
				rssHref: "/rss.xml",
			},
		});
		const github = screen.getByRole("link", { name: "GitHub" });
		expect(github.getAttribute("href")).toBe("https://github.com/xunrua");
		expect(github.getAttribute("target")).toBe("_blank");
		expect(github.getAttribute("rel")).toBe("noopener noreferrer");
		expect(screen.getByRole("link", { name: "RSS" }).getAttribute("href")).toBe("/rss.xml");
		cleanup();
		setup();
		expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
		expect(screen.queryByRole("link", { name: "RSS" })).toBeNull();
	});

	describe("最新两条的按条占位", () => {
		const post = { title: "测试发送", date: "10.10", href: "/blog/test" };
		const note = { title: "实时状态接入，发布 2.22.1", date: "10.29", href: "/notes/1" };
		const grid = (container: HTMLElement) =>
			container.querySelector<HTMLElement>('[data-slot="profile-latest"]');
		const placeholders = (container: HTMLElement) =>
			container.querySelectorAll('[data-slot="profile-latest-pending"]');

		it("两条都在加载：两块占位、没有链接，aria-hidden，两列", () => {
			const { container } = setup({ latestPending: { post: true, note: true } });
			expect(placeholders(container)).toHaveLength(2);
			for (const block of placeholders(container)) {
				expect(block.getAttribute("aria-hidden")).toBe("true");
			}
			expect(screen.queryByRole("link", { name: /新文章|新手记/ })).toBeNull();
			expect(grid(container)?.className).toContain("grid-cols-2");
		});

		it("文章到、手记仍在加载：两列，文章在前是真实卡片，手记是占位", () => {
			const { container } = setup({ latest: { post }, latestPending: { note: true } });
			expect(grid(container)?.className).toContain("grid-cols-2");
			expect(grid(container)?.children[0]).toBe(screen.getByRole("link", { name: /新文章/ }));
			expect(placeholders(container)).toHaveLength(1);
			expect(grid(container)?.children[1]).toBe(placeholders(container)[0]);
		});

		it("文章仍在加载、手记先到：文章位是占位，手记在后", () => {
			const { container } = setup({ latest: { note }, latestPending: { post: true } });
			expect(grid(container)?.children[0]).toBe(placeholders(container)[0]);
			expect(grid(container)?.children[1]).toBe(screen.getByRole("link", { name: /新手记/ }));
		});

		it("手记失败（不再加载且无值）：退为单列，文章独占一行", () => {
			const { container } = setup({ latest: { post }, latestPending: { post: false } });
			expect(grid(container)?.className).toContain("grid-cols-1");
			expect(placeholders(container)).toHaveLength(0);
		});

		it("只有文章 pending 解除：版式仍是两列", () => {
			const { container, rerender } = setup({
				latest: { note },
				latestPending: { post: true },
			});
			expect(grid(container)?.className).toContain("grid-cols-2");
			rerender(<ProfileCard {...base} latest={{ post, note }} latestPending={{}} />);
			expect(grid(container)?.className).toContain("grid-cols-2");
			expect(placeholders(container)).toHaveLength(0);
		});

		it("两条都缺且都不在加载：整行不出现", () => {
			const { container } = setup({
				latest: {},
				latestPending: { post: false, note: false },
			});
			expect(grid(container)).toBeNull();
			expect(placeholders(container)).toHaveLength(0);
		});

		it("真实卡片与占位共用同一个最小高度", () => {
			const { container } = setup({ latest: { post }, latestPending: { note: true } });
			expect(screen.getByRole("link", { name: /新文章/ }).className).toContain("min-h-22");
			expect(placeholders(container)[0]?.className).toContain("min-h-22");
		});
	});
});
