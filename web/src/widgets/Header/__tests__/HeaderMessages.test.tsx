import type { UserDTO } from "@entities/user/model/types";
import { chatKeys } from "@features/chat/api/keys";
import type { ChatConversation, ChatMessage, ChatUser } from "@features/chat/model/types";
import { notificationKeys } from "@features/notifications/api/keys";
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
import { afterEach, describe, expect, it, vi } from "vitest";
import HeaderMessages from "../HeaderMessages";

vi.mock("@features/notifications/hooks/useNotificationStream", () => ({
	useNotificationStream: () => {},
}));
vi.mock("@features/notifications/hooks/useNotificationPushNotifications", () => ({
	useNotificationPushNotifications: () => ({ enabled: false, supported: false }),
}));

const ME: UserDTO = {
	id: "me",
	username: "xunrua",
	display_name: "",
	email: "x@example.com",
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
const CLAUDE: ChatUser = { id: "bot", username: "claude", display_name: "Claude", avatar_url: "" };

const MESSAGE: ChatMessage = {
	id: "m1",
	conversation_id: "c1",
	sender: CLAUDE,
	type: "text",
	content: "摘要已经整理好了",
	reactions: [],
	is_deleted: false,
	created_at: "2026-11-09T09:58:00+08:00",
};
const CONVERSATION: ChatConversation = {
	id: "c1",
	kind: "direct",
	title: "",
	owner: CLAUDE,
	members: [
		{
			user: { ...CLAUDE, id: "me", username: "xunrua", display_name: "xunrua" },
			role: "owner",
			joined_at: "",
			is_muted: false,
		},
		{ user: CLAUDE, role: "member", joined_at: "", is_muted: false },
	],
	last_message: MESSAGE,
	unread_count: 2,
	created_at: "2026-11-01T00:00:00Z",
	updated_at: "2026-11-09T09:58:00+08:00",
};

function renderAt(path: string, children: React.ReactNode) {
	const root = createRootRoute({
		component: () => (
			<>
				{children}
				<Outlet />
			</>
		),
	});
	const router = createRouter({
		routeTree: root.addChildren(
			["/", "/chat"].map((to) =>
				createRoute({ getParentRoute: () => root, path: to, component: () => null }),
			),
		),
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
	queryClient.setQueryData(notificationKeys.unreadCount, { unread_count: 3 });
	queryClient.setQueryData([...notificationKeys.list, { page: 1, limit: 10 }], {
		data: [],
		pagination: { limit: 10 },
	});
	queryClient.setQueryData(chatKeys.unreadCount(), { unread_count: 2 });
	queryClient.setQueryData(chatKeys.conversations(), {
		data: [CONVERSATION],
		pagination: { limit: 20 },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("HeaderMessages", () => {
	it("角标是通知与聊天未读之和；聊天标签列出会话与各自未读", async () => {
		renderAt("/", <HeaderMessages user={ME} />);
		fireEvent.click(await screen.findByRole("button", { name: "消息，5 条未读" }));
		expect(screen.getByRole("tab", { name: /^通知\s*3$/ })).toBeTruthy();
		fireEvent.mouseDown(screen.getByRole("tab", { name: /^聊天\s*2$/ }));
		const row = await screen.findByRole("button", { name: /^Claude/ });
		expect(row.getAttribute("aria-label")).toContain("摘要已经整理好了");
		expect(row.getAttribute("aria-label")).toContain("2 条未读");
	});
});
