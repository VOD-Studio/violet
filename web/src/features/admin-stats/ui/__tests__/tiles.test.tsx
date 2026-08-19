import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { DashboardStatsDTO } from "../../model/types";
import { MilestoneTile } from "../MilestoneTile";
import { PopularPostsTile } from "../PopularPostsTile";
import { RecentPostsTile } from "../RecentPostsTile";
import { StatsStrip } from "../StatsStrip";

/**
 * 概览区块空态/边界态渲染测试。
 *
 * 空态是驾驶舱的情感设计面，新站点首次进入后台必然命中，回归价值高。
 */

/** 区块内 Link 依赖 router 上下文，用最小 memory history router 渲染；RouterProvider 挂载是异步的，断言一律等待 load() */
async function renderWithRouter(ui: ReactElement) {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => ui,
	});
	const commentsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/admin/comments",
		component: () => null,
	});
	const blogRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/blog/$slug",
		component: () => null,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute, commentsRoute, blogRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(<RouterProvider router={router} />);
	await router.load();
}

/** 全零统计：新站点首进概览的形态 */
const emptyStats: DashboardStatsDTO = {
	total_posts: 0,
	total_comments: 0,
	pending_comments: 0,
	pending_friend_links: 0,
	failing_subscriptions: 0,
	total_views: 0,
	today_views: 0,
	yesterday_views: 0,
	week_comments: 0,
	last_week_comments: 0,
	total_users: 0,
	recent_posts: [],
	popular_posts: [],
};

describe("StatsStrip 仪表带", () => {
	it("全零读数渲染所有 mono 小签与标签", () => {
		render(<StatsStrip data={emptyStats} daily={[]} />);
		expect(screen.getByText("views.today")).toBeTruthy();
		expect(screen.getByText("今日浏览")).toBeTruthy();
		expect(screen.getByText("comments.pending")).toBeTruthy();
		// 仪表带无空态文案，=0 就是安静的 0 读数
		expect(screen.queryByText("订阅运行正常")).toBeNull();
	});

	it("待办 >0 的格子变成直达链接", async () => {
		await renderWithRouter(
			<StatsStrip data={{ ...emptyStats, pending_comments: 3 }} daily={[]} />,
		);
		expect(screen.getByText("去审核 →")).toBeTruthy();
	});

	it("待办 =0 的格子是安静读数（无直达文案）", () => {
		render(<StatsStrip data={emptyStats} daily={[]} />);
		expect(screen.queryByText(/→$/)).toBeNull();
	});
});

describe("区块空态", () => {
	it("热门文章空列表显示占位", async () => {
		await renderWithRouter(<PopularPostsTile posts={[]} />);
		expect(screen.getByText("暂无热门文章")).toBeTruthy();
	});

	it("最近发布空列表显示引导文案", () => {
		render(<RecentPostsTile posts={[]} />);
		expect(screen.getByText("还没有文章")).toBeTruthy();
	});

	it("里程碑零值显示累计读数与差额", () => {
		render(<MilestoneTile totalViews={0} />);
		expect(screen.getByText("累计浏览")).toBeTruthy();
		// 1k 档差额 1,000（remaining 独立 span，数字部分单独断言）
		expect(screen.getByText("1,000")).toBeTruthy();
	});
});
