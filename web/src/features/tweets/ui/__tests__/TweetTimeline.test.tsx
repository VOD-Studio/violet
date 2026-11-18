import type { Tweet } from "@entities/tweet/model/types";
import { ApiError } from "@shared/api/error";
import { apiGet, apiGetPaged } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { timelineOptions } from "../../api/queries";
import type { TweetSidebar } from "../../model/types";
import { TweetTimeline } from "../TweetTimeline";

let loggedIn: boolean;
let queryClient: QueryClient;

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: loggedIn ? { id: "author" } : null }),
}));
vi.mock("@shared/api/request", () => ({ apiGet: vi.fn(), apiGetPaged: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		search,
		"aria-label": label,
	}: {
		children: ReactNode;
		to: string;
		params: Record<string, string>;
		search?: { image?: number };
		"aria-label"?: string;
	}) => (
		<a
			href={
				to.replace(/\$(\w+)/g, (_, key) => encodeURIComponent(params[key])) +
				(search?.image ? `?image=${search.image}` : "")
			}
			aria-label={label}
		>
			{children}
		</a>
	),
}));
vi.mock("../TweetCard", () => ({
	default: ({ tweet }: { tweet: Tweet }) => <article aria-label={`推文 ${tweet.id}`} />,
}));
vi.mock("../TweetComposer", () => ({ TweetComposer: () => <form aria-label="发布推文" /> }));

const sidebar: TweetSidebar = {
	authors: [
		{
			id: "author",
			username: "sidebar-user",
			display_name: "独立作者",
			avatar_url: "",
			count: 57,
		},
	],
	topics: [{ tag: "开发", count: 31 }],
	images: [
		{
			url: "/uploads/sidebar.png",
			tweet_id: "sidebar-tweet",
			index: 1,
			width: null,
			height: null,
		},
	],
};

function page(ids: string[], next_cursor?: string) {
	return {
		data: ids.map(
			(id): Tweet => ({
				id,
				author: { id: "author", username: "user", avatar_url: "" },
				content: "与侧栏无关的正文",
				images: [],
				like_count: 0,
				is_liked: false,
				comment_count: 0,
				quote_count: 0,
				view_count: 0,
				created_at: "2026-11-18T00:00:00Z",
				link_cards: [],
			}),
		),
		pagination: { limit: 20, next_cursor },
	};
}

function Wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("公开推文时间线", () => {
	beforeEach(() => {
		loggedIn = false;
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false, staleTime: Infinity } },
		});
		vi.resetAllMocks();
		vi.mocked(apiGet).mockResolvedValue(sidebar);
		vi.mocked(apiGetPaged).mockImplementation(async (path, config) => {
			const { cursor, sort } = config?.params ?? {};
			if (path === "/tweets/topics/%E5%BC%80%E5%8F%91") {
				return cursor ? page(["topic-two"]) : page(["topic-one"], "topic-cursor");
			}
			if (sort === "hot") return page(["server-first", "server-second"]);
			if (sort === "images") return page(["photo-result"]);
			return cursor ? page(["global-two"]) : page(["global-one"], "latest-cursor");
		});
	});

	it("匿名可阅读并继续加载；切换筛选时使用独立的服务端结果，返回最新后保留已读两页", async () => {
		const { rerender } = render(<TweetTimeline />, { wrapper: Wrapper });
		expect(screen.queryByRole("form", { name: "发布推文" })).toBeNull();
		await screen.findByRole("article", { name: "推文 global-one" });
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		await screen.findByRole("article", { name: "推文 global-two" });

		rerender(<TweetTimeline sort="images" />);
		await screen.findByRole("article", { name: "推文 photo-result" });
		expect(screen.getAllByRole("article")).toHaveLength(1);
		rerender(<TweetTimeline />);
		expect(screen.getAllByRole("article")).toHaveLength(2);
		expect(apiGetPaged).toHaveBeenCalledTimes(3);
		expect(apiGetPaged).toHaveBeenNthCalledWith(
			1,
			"/tweets",
			expect.objectContaining({ params: { limit: 20, cursor: undefined } }),
		);
		expect(apiGetPaged).toHaveBeenNthCalledWith(
			2,
			"/tweets",
			expect.objectContaining({ params: { limit: 20, cursor: "latest-cursor" } }),
		);
	});

	it("登录后发布器排在第一张推文前；服务端预取的热门首页由同一无限查询消费", async () => {
		loggedIn = true;
		await queryClient.prefetchInfiniteQuery(timelineOptions("hot"));
		render(<TweetTimeline sort="hot" header={<h1>推文</h1>} />, { wrapper: Wrapper });

		expect(screen.getByRole("heading", { name: "推文" })).toBeTruthy();
		const feed = screen.getByRole("region", { name: "推文时间线" });
		const composer = within(feed).getByRole("form", { name: "发布推文" });
		const cards = within(feed).getAllByRole("article");
		expect(
			composer.compareDocumentPosition(cards[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
			"推文 server-first",
			"推文 server-second",
		]);
		expect(apiGetPaged).toHaveBeenCalledTimes(1);
	});

	it("热门游标过期时保留已读页，点重拿首页后不再使用过期游标", async () => {
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce(page(["previous"], "expired-cursor"))
			.mockRejectedValueOnce(
				new ApiError({
					error: "TWEET_HOT_CURSOR_EXPIRED",
					message: "热门已更新",
					status: 409,
				}),
			)
			.mockResolvedValueOnce(page(["fresh"], "fresh-cursor"));

		render(<TweetTimeline sort="hot" />, { wrapper: Wrapper });
		await screen.findByRole("article", { name: "推文 previous" });
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		const restart = await screen.findByRole("button", { name: "重新加载热门首页" });
		expect(screen.getByRole("article", { name: "推文 previous" })).toBeTruthy();
		fireEvent.click(restart);
		await screen.findByRole("article", { name: "推文 fresh" });
		expect(screen.queryByRole("article", { name: "推文 previous" })).toBeNull();
		expect(apiGetPaged).toHaveBeenNthCalledWith(
			3,
			"/tweets",
			expect.objectContaining({ params: { limit: 20, sort: "hot", cursor: undefined } }),
		);
	});

	it("普通分页错误保留已读页，重试仍从下一页游标继续", async () => {
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce(page(["previous"], "next-cursor"))
			.mockRejectedValueOnce(new Error("网络错误"))
			.mockResolvedValueOnce(page(["next"]));
		render(<TweetTimeline />, { wrapper: Wrapper });

		await screen.findByRole("article", { name: "推文 previous" });
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		const retry = await screen.findByRole("button", { name: "重试" });
		expect(screen.getByRole("article", { name: "推文 previous" })).toBeTruthy();
		fireEvent.click(retry);
		await screen.findByRole("article", { name: "推文 next" });
		expect(apiGetPaged).toHaveBeenNthCalledWith(
			3,
			"/tweets",
			expect.objectContaining({ params: { limit: 20, cursor: "next-cursor" } }),
		);
	});

	it("发现侧栏独立于时间线，有可导航的作者、话题和图片，失败也能单独重试", async () => {
		vi.mocked(apiGet).mockRejectedValueOnce(new Error("网络错误"));
		render(<TweetTimeline />, { wrapper: Wrapper });
		await screen.findByRole("article", { name: "推文 global-one" });
		fireEvent.click(await screen.findByRole("button", { name: "重试发现内容" }));
		const rail = screen.getByRole("complementary", { name: "发现推文" });
		await within(rail).findByRole("heading", { name: "活跃作者" });
		expect(
			within(rail)
				.getAllByRole("heading", { level: 3 })
				.map((node) => node.textContent),
		).toEqual(["活跃作者", "话题", "最近的图片"]);
		expect(
			within(rail).getByRole("link", { name: "独立作者 57 条" }).getAttribute("href"),
		).toBe("/users/sidebar-user");
		expect(within(rail).getByRole("link", { name: "#开发 31 条" }).getAttribute("href")).toBe(
			"/tweets/topics/%E5%BC%80%E5%8F%91",
		);
		expect(
			within(rail)
				.getByRole("link", { name: "查看第 2 张图片所在的推文" })
				.getAttribute("href"),
		).toBe("/tweets/sidebar-tweet?image=2");
		expect(
			screen.getByRole("link", { name: "浏览作者、话题与图片" }).getAttribute("href"),
		).toBe(`#${rail.id}`);
		expect(apiGetPaged).toHaveBeenCalledTimes(1);
	});

	it("话题流只请求该话题的推文与下一页", async () => {
		render(<TweetTimeline tag="开发" />, { wrapper: Wrapper });
		await screen.findByRole("article", { name: "推文 topic-one" });
		fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
		await screen.findByRole("article", { name: "推文 topic-two" });
		expect(apiGetPaged).toHaveBeenCalledTimes(2);
		expect(apiGet).not.toHaveBeenCalled();
	});
});
