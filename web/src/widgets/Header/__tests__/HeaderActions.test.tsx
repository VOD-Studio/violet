import type { UserDTO } from "@entities/user/model/types";
import { chatKeys } from "@features/chat/api/keys";
import { notificationKeys } from "@features/notifications/api/keys";
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
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HeaderActions from "../HeaderActions";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: "system", setTheme }),
}));
// 事件流与权限查询要连接后端；这里只关心头部的呈现
vi.mock("@features/chat/hooks/useChatStream", () => ({ useChatStream: () => {} }));
vi.mock("@features/notifications/hooks/useNotificationStream", () => ({
	useNotificationStream: () => {},
}));
vi.mock("@features/notifications/hooks/useNotificationPushNotifications", () => ({
	useNotificationPushNotifications: () => ({ enabled: false, supported: false }),
}));
vi.mock("@features/auth/hooks/usePermissions", () => ({ useHasPermission: () => false }));

const user: UserDTO = {
	id: "u1",
	username: "violet",
	display_name: "",
	email: "violet@example.com",
	avatar_url: "",
	cover_url: "",
	bio: "",
	role: "user",
	is_root: false,
	email_verified: true,
	is_active: true,
	created_at: "2026-01-01T00:00:00Z",
	has_password: true,
	google_bound: false,
	github_bound: false,
};

type Preset = "spring" | "summer" | "autumn" | "winter";

function renderActions(
	options: {
		user?: UserDTO | null;
		unread?: { notification: number; chat: number };
		preset?: Preset;
	} = {},
) {
	const root = createRootRoute({
		beforeLoad: () => ({
			theme: {
				preference: "follow" as const,
				preset: options.preset ?? ("autumn" as const),
				custom: null,
			},
			decoration: "theme" as const,
			decorationLayers: DEFAULT_DECORATION_LAYERS,
		}),
		component: () => (
			<>
				<HeaderActions user={options.user} />
				<Outlet />
			</>
		),
	});
	const empty = () => null;
	const router = createRouter({
		routeTree: root.addChildren(
			["/", "/login"].map((path) =>
				createRoute({ getParentRoute: () => root, path, component: empty }),
			),
		),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	// 预置的数据永不过期，免得挂载时去请求后端
	const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
	if (options.user) {
		queryClient.setQueryData(notificationKeys.unreadCount, {
			unread_count: options.unread?.notification ?? 0,
		});
		queryClient.setQueryData(chatKeys.unreadCount(), {
			unread_count: options.unread?.chat ?? 0,
		});
		queryClient.setQueryData([...notificationKeys.list, { page: 1, limit: 10 }], {
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		});
	}
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return router;
}

describe("HeaderActions", () => {
	beforeEach(() => setTheme.mockClear());
	afterEach(cleanup);

	it("未登录：有登录入口，没有消息铃铛与头像菜单", async () => {
		renderActions();
		const login = await screen.findByRole("link", { name: "登录" });
		expect(login.getAttribute("href")).toBe("/login");
		expect(screen.queryByRole("button", { name: /^消息/ })).toBeNull();
		expect(screen.queryByRole("button", { name: "用户菜单" })).toBeNull();
	});

	it("登录后：有消息铃铛与用户菜单，没有登录入口", async () => {
		renderActions({ user });
		expect(await screen.findByRole("button", { name: /^消息/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: "用户菜单" })).toBeTruthy();
		expect(screen.queryByRole("link", { name: "登录" })).toBeNull();
	});

	it("控件常驻可见，右药丸里没有聊天链接与搜索按钮", async () => {
		renderActions({ user, unread: { notification: 0, chat: 3 } });
		await screen.findByRole("button", { name: /^消息/ });
		expect(screen.getByRole("button", { name: /^季节与外观：/ })).toBeTruthy();
		expect(screen.queryByRole("link", { name: /^聊天/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /^搜索/ })).toBeNull();
	});

	it("铃铛的名称与角标是通知未读加聊天未读", async () => {
		renderActions({ user, unread: { notification: 2, chat: 3 } });
		const bell = await screen.findByRole("button", { name: "消息，5 条未读" });
		expect(bell.parentElement?.querySelector('[data-slot="count"]')?.textContent).toBe("5");
	});

	it("没有未读时铃铛不带数字也没有角标", async () => {
		renderActions({ user });
		const bell = await screen.findByRole("button", { name: "消息" });
		expect(bell.parentElement?.querySelector('[data-slot="count"]')).toBeNull();
	});

	it("只有聊天未读时也计入铃铛", async () => {
		renderActions({ user, unread: { notification: 0, chat: 4 } });
		expect(await screen.findByRole("button", { name: "消息，4 条未读" })).toBeTruthy();
	});

	it("季节与外观入口的名称随当前预设变化", async () => {
		renderActions({ preset: "spring" });
		expect(await screen.findByRole("button", { name: "季节与外观：花朝" })).toBeTruthy();
	});

	it("季节与外观面板有外观与主题配色，外观可切换", async () => {
		renderActions();
		fireEvent.click(await screen.findByRole("button", { name: "季节与外观：桂月" }));
		const panel = await screen.findByRole("dialog", { name: "季节与外观" });
		const appearance = within(panel).getByRole("region", { name: "外观" });
		expect(within(appearance).getByRole("radio", { name: "亮色" })).toBeTruthy();
		expect(within(appearance).getByRole("radio", { name: "暗黑" })).toBeTruthy();
		expect(within(appearance).getByRole("radio", { name: "跟随系统" })).toBeTruthy();
		expect(within(panel).getByRole("region", { name: "主题配色" })).toBeTruthy();

		fireEvent.click(within(appearance).getByRole("radio", { name: "暗黑" }));
		expect(setTheme).toHaveBeenCalledWith("dark");
	});

	it("未登录时按 Ctrl+L 跳到登录页", async () => {
		const router = renderActions();
		await screen.findByRole("link", { name: "登录" });
		fireEvent.keyDown(window, { key: "l", ctrlKey: true });
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
	});

	it("登录后按 Ctrl+L 不跳转", async () => {
		const router = renderActions({ user });
		await screen.findByRole("button", { name: "用户菜单" });
		fireEvent.keyDown(window, { key: "l", ctrlKey: true });
		await act(async () => {});
		expect(router.state.location.pathname).toBe("/");
	});
});
