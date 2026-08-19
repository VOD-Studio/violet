import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { MessageSquareWarning } from "lucide-react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ActionTile } from "../ActionTile";
import { HeroViewsTile } from "../HeroViewsTile";
import { PopularPostsTile } from "../PopularPostsTile";
import { RecentPostsTile } from "../RecentPostsTile";

/**
 * 概览 tile 空态/边界态渲染测试。
 *
 * 空态是驾驶舱的情感设计面（等待第一位读者 / 队列已清空），
 * 新站点首次进入后台必然命中，回归价值高。
 */

/** tile 内 Link 依赖 router 上下文，用最小 memory history router 渲染；RouterProvider 挂载是异步的，断言一律用 findBy* */
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

describe("tile 空态", () => {
	it("行动卡待办 0 显示安心文案", async () => {
		await renderWithRouter(
			<ActionTile
				title="待审评论"
				count={0}
				icon={MessageSquareWarning}
				emptyLabel="队列已清空"
				actionLabel="去审核"
				to="/admin/comments"
			/>,
		);
		expect(screen.getByText("队列已清空")).toBeTruthy();
	});

	it("行动卡待办 >0 显示数字与直达入口", async () => {
		await renderWithRouter(
			<ActionTile
				title="待审评论"
				count={3}
				icon={MessageSquareWarning}
				emptyLabel="队列已清空"
				actionLabel="去审核"
				to="/admin/comments"
			/>,
		);
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("去审核")).toBeTruthy();
	});

	it("Hero 全零显示等待第一位读者", () => {
		render(<HeroViewsTile today={0} yesterday={0} daily={[]} />);
		expect(screen.getByText("等待第一位读者")).toBeTruthy();
	});

	it("Hero 昨日 0 今日有量显示无环比提示", () => {
		render(<HeroViewsTile today={5} yesterday={0} daily={[]} />);
		expect(screen.getByText("5")).toBeTruthy();
		expect(screen.getByText("昨日无浏览，无环比")).toBeTruthy();
	});

	it("热门文章空列表显示占位", async () => {
		await renderWithRouter(<PopularPostsTile posts={[]} />);
		expect(screen.getByText("暂无热门文章")).toBeTruthy();
	});

	it("最近发布空列表显示引导文案", () => {
		render(<RecentPostsTile posts={[]} />);
		expect(screen.getByText("还没有文章")).toBeTruthy();
	});
});
