import type * as NotificationsApi from "@shared/api/notifications";
import type { NotificationItem } from "@shared/api/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationKeys } from "../../api/keys";
import NotificationBell from "../NotificationBell";

const markNotificationRead = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@shared/api/notifications", async (importOriginal) => ({
	...(await importOriginal<typeof NotificationsApi>()),
	markNotificationRead,
}));
vi.mock("../../hooks/useNotificationStream", () => ({ useNotificationStream: () => {} }));
vi.mock("../../hooks/useNotificationPushNotifications", () => ({
	useNotificationPushNotifications: () => ({ enabled: false, supported: false }),
}));

const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
	id: "n1",
	source_type: "tweet_liked",
	source_id: "t1",
	title: "有人赞了你的推文",
	body: "",
	payload: {},
	is_read: false,
	created_at: new Date().toISOString(),
	...overrides,
});

function renderBell(items: NotificationItem[]) {
	const root = createRootRoute({
		component: () => (
			<>
				<NotificationBell />
				<Outlet />
			</>
		),
	});
	const router = createRouter({
		routeTree: root.addChildren(
			["/", "/tweets/$id", "/announcements/$id"].map((path) =>
				createRoute({
					getParentRoute: () => root,
					path,
					component: () => <div data-testid="page">{path}</div>,
				}),
			),
		),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
	queryClient.setQueryData(notificationKeys.unreadCount, {
		unread_count: items.filter((n) => !n.is_read).length,
	});
	queryClient.setQueryData([...notificationKeys.list, { page: 1, limit: 10 }], {
		data: items,
		pagination: { limit: 10 },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return router;
}

describe("NotificationBell", () => {
	beforeEach(() => markNotificationRead.mockClear());
	afterEach(cleanup);

	it("点未读的推文互动：标已读、收起面板并落到推文详情", async () => {
		const router = renderBell([item({})]);
		fireEvent.click(await screen.findByRole("button", { name: /^消息/ }));
		fireEvent.click(await screen.findByRole("button", { name: /赞了你的推文/ }));
		await vi.waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
		expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull();
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/tweets/t1"));
	});

	it("公告通知落到公告详情页；已读的通知不再重复标记", async () => {
		const router = renderBell([
			item({
				source_type: "announcement",
				title: "新公告「站点升级」",
				payload: { announcement_id: 7 },
				is_read: true,
			}),
		]);
		fireEvent.click(await screen.findByRole("button", { name: /^消息/ }));
		fireEvent.click(await screen.findByRole("button", { name: /站点升级/ }));
		expect(markNotificationRead).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/announcements/7"));
	});

	it("房间邀请打开对应会话", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderBell([
			item({
				source_type: "chat_room_invited",
				title: "新的聊天邀请",
				payload: { conversation_id: "c9" },
			}),
		]);
		fireEvent.click(await screen.findByRole("button", { name: /^消息/ }));
		fireEvent.click(await screen.findByRole("button", { name: /新的聊天邀请/ }));
		expect(pushState).toHaveBeenCalledWith({}, "", "/chat?c=c9");
		pushState.mockRestore();
	});
});
