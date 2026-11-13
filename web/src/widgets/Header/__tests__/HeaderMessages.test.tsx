import type { UserDTO } from "@entities/user/model/types";
import { chatKeys } from "@features/chat/api/keys";
import { useChatAlertStore } from "@features/chat/model/chat-alert-store";
import type { ChatConversation, ChatMessage, ChatUser } from "@features/chat/model/types";
import { notificationKeys } from "@features/notifications/api/keys";
import { MessageCenter } from "@shared/ui/message-panel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HeaderChatToast from "../HeaderChatToast";
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

function MessagesHost() {
	const [open, setOpen] = useState(false);
	return (
		<HeaderMessages user={ME} onNavigate={() => setOpen(false)}>
			{(panel) => <MessageCenter {...panel} open={open} onOpenChange={setOpen} />}
		</HeaderMessages>
	);
}

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
	useChatAlertStore.getState().clear();
});

describe("HeaderMessages", () => {
	it("角标是通知与聊天未读之和；聊天标签列出会话与各自未读", async () => {
		renderAt("/", <MessagesHost />);
		const bell = await screen.findByRole("button", { name: "消息，5 条未读" });
		expect(screen.getByText("5")).toBeTruthy();
		fireEvent.click(bell);
		expect(screen.getByRole("tab", { name: /^通知\s*3$/ })).toBeTruthy();
		fireEvent.mouseDown(screen.getByRole("tab", { name: /^聊天\s*2$/ }));
		const row = await screen.findByRole("button", { name: /^Claude/ });
		expect(row.getAttribute("aria-label")).toContain("摘要已经整理好了");
		expect(row.getAttribute("aria-label")).toContain("2 条未读");
	});

	it("选择聊天会话关闭受控面板并打开会话", async () => {
		const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});
		try {
			renderAt("/", <MessagesHost />);
			const bell = await screen.findByRole("button", { name: "消息，5 条未读" });
			fireEvent.click(bell);
			fireEvent.mouseDown(screen.getByRole("tab", { name: /^聊天/ }));
			fireEvent.click(await screen.findByRole("button", { name: /^Claude/ }));
			expect(pushState).toHaveBeenCalledWith({}, "", "/chat?c=c1");
			expect(bell.getAttribute("aria-expanded")).toBe("false");
			await waitFor(() => expect(screen.queryByRole("dialog", { name: "消息" })).toBeNull());
		} finally {
			pushState.mockRestore();
		}
	});
});

describe("HeaderChatToast", () => {
	const raise = () =>
		act(() => {
			useChatAlertStore
				.getState()
				.raise({ conversationID: "c1", messageID: "m1", senderID: CLAUDE.id });
		});

	it("不在聊天室时，新消息弹出带回复的轻提示", async () => {
		renderAt("/", <HeaderChatToast user={ME} />);
		await act(async () => {});
		raise();
		await screen.findByRole("button", { name: "回复" });
		expect(screen.getByRole("status").textContent).toContain("Claude 发来一条消息");
		expect(screen.getByRole("status").textContent).toContain("摘要已经整理好了");
	});

	it("在聊天室内新消息不弹轻提示", async () => {
		renderAt("/chat", <HeaderChatToast user={ME} />);
		await act(async () => {});
		raise();
		await act(async () => {});
		expect(screen.getByRole("status").textContent).toBe("");
		expect(screen.queryByRole("button", { name: "回复" })).toBeNull();
	});
});
