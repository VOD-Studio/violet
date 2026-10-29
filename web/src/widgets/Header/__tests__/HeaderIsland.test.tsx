import type { PresenceReceipt } from "@features/presence/lib/presence";
import { DEFAULT_DECORATION_LAYERS } from "@shared/lib/decoration-preference";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HeaderIsland from "../HeaderIsland";

function renderAt(path: string, presence?: PresenceReceipt) {
	const root = createRootRoute({
		// 面板里的主题选择读取根路由上下文
		beforeLoad: () => ({
			theme: { preference: "follow" as const, preset: "autumn" as const, custom: null },
			decoration: "theme" as const,
			decorationLayers: DEFAULT_DECORATION_LAYERS,
		}),
		component: () => (
			<>
				<HeaderIsland />
				<Outlet />
			</>
		),
	});
	const empty = () => null;
	const router = createRouter({
		routeTree: root.addChildren(
			["/", "/blog", "/blog/archive", "/series", "/galleries", "/lab", "/chat"].map((p) =>
				createRoute({ getParentRoute: () => root, path: p, component: empty }),
			),
		),
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	const queryClient = new QueryClient();
	if (presence) queryClient.setQueryData(["presence", "current"], presence);
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return router;
}

describe("HeaderIsland", () => {
	afterEach(cleanup);

	it("收起时显示主要入口，当前页带文字标出，全部导航收在「更多」里", async () => {
		renderAt("/series");
		const nav = await screen.findByRole("navigation", { name: "移动端导航" });
		expect(nav.querySelectorAll("a")).toHaveLength(4);
		expect(nav.querySelector('a[aria-current="page"]')?.getAttribute("aria-label")).toBe(
			"系列",
		);
		expect(screen.queryByText("浏览本站", { exact: false })).toBeNull();
	});

	it("点「更多」展开全部导航，Esc 收起", async () => {
		renderAt("/");
		const more = await screen.findByRole("button", { name: "展开全部导航" });
		// 等挂载期 effect 跑完再点，避免与「路径变化收起」首轮 effect 竞态
		await act(async () => {});
		fireEvent.click(more);
		await screen.findByText("Violet · 浏览本站");
		expect(screen.getByRole("link", { name: "实验室" })).toBeTruthy();
		const themes = screen.getByRole("radiogroup", { name: "主题" });
		expect(
			within(themes).getByRole("radio", { name: "跟随季节" }).getAttribute("aria-checked"),
		).toBe("true");

		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByText("Violet · 浏览本站")).toBeNull());
	});

	it("导航后自动收起面板", async () => {
		const router = renderAt("/");
		const more = await screen.findByRole("button", { name: "展开全部导航" });
		await act(async () => {});
		fireEvent.click(more);
		await screen.findByText("Violet · 浏览本站");

		await act(async () => {
			await router.navigate({ to: "/blog" });
		});
		await waitFor(() => expect(screen.queryByText("Violet · 浏览本站")).toBeNull());
	});

	it.each([
		["/lab", "实验室"],
		["/blog/archive", "归档"],
	])("在 %s 用当前菜单替代更多入口，并仍可展开全部导航", async (path, label) => {
		renderAt(path);
		const more = await screen.findByRole("button", { name: `${label}，展开全部导航` });
		expect(more.getAttribute("aria-current")).toBe("page");
		expect(more.textContent).toBe(label);
		fireEvent.click(more);
		const selected = await screen.findByRole("link", { name: label });
		expect(selected.getAttribute("aria-current")).toBe("page");
	});

	it("有在线设备时，展开面板顶部列出此刻的媒体、应用与窗口", async () => {
		const now = Date.now();
		renderAt("/", {
			receivedAt: now,
			presence: {
				generated_at: new Date(now).toISOString(),
				devices: [
					{
						id: "10000000-0000-4000-8000-000000000001",
						display_name: "MacBook Pro",
						updated_at: new Date(now).toISOString(),
						expires_at: new Date(now + 45_000).toISOString(),
						sources: {
							application: { display_name: "Code" },
							window: { title: "HeaderIsland.tsx — violet" },
							media: {
								session_id: "30000000-0000-4000-8000-000000000003",
								player_name: "QQ 音乐",
								title: "晴天",
								artist: "周杰伦",
								album: "叶惠美",
								state: "playing",
								duration_ms: 269_000,
								position_ms: 102_000,
								rate: 1,
							},
						},
					},
				],
			},
		});
		const more = await screen.findByRole("button", { name: "展开全部导航" });
		await act(async () => {});
		fireEvent.click(more);
		const card = await screen.findByRole("region", { name: "此刻" });
		expect(within(card).getByText("晴天")).toBeTruthy();
		expect(within(card).getByText("正在播放 · QQ 音乐")).toBeTruthy();
		expect(within(card).getByText("Code")).toBeTruthy();
		expect(within(card).getByText("HeaderIsland.tsx — violet")).toBeTruthy();
		expect(within(card).getByRole("progressbar", { name: "播放进度" })).toBeTruthy();
	});

	it("聊天全屏页不显示，避免盖住输入栏", async () => {
		renderAt("/chat");
		await waitFor(() =>
			expect(screen.queryByRole("navigation", { name: "移动端导航" })).toBeNull(),
		);
	});
});
