/**
 * ChatWorkspace 组件测试
 *
 * 验证：
 * 1. 正常渲染侧边栏会话列表和消息区域
 * 2. 输入框使用 RichCommentInput 并提供表情选择、图片选择、发送按钮
 * 3. 消息列表中正确渲染消息内容与气泡
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ChatMessageReference } from "../../model/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		...props
	}: {
		to: string;
		params?: { username?: string };
		children: ReactNode;
		"aria-label"?: string;
		className?: string;
	}) => (
		<a {...props} href={params?.username ? `/users/${params.username}` : to}>
			{children}
		</a>
	),
}));

const mockMe = {
	id: "u_me",
	username: "xfy",
	display_name: "xfy",
	avatar_url: "",
};

const mockOtherUser = {
	id: "u_other",
	username: "dfy",
	display_name: "dfy",
	avatar_url: "",
};

const mockContact = {
	id: "u_contact",
	username: "alice",
	display_name: "Alice",
	avatar_url: "",
};
const mockSecondContact = {
	id: "u_second_contact",
	username: "bob",
	display_name: "Bob",
	avatar_url: "",
};

const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: "c_2" });

const mockConversation = {
	id: "c_1",
	kind: "direct" as const,
	title: "",
	owner: mockMe,
	members: [
		{
			user: mockMe,
			role: "owner" as const,
			joined_at: "2026-08-20T08:00:00Z",
			is_muted: false,
		},
		{
			user: mockOtherUser,
			role: "member" as const,
			joined_at: "2026-08-20T08:00:00Z",
			is_muted: false,
		},
	],
	unread_count: 0,
	created_at: "2026-08-20T08:00:00Z",
	updated_at: "2026-08-20T08:30:00Z",
	last_message: {
		id: "m_1",
		conversation_id: "c_1",
		sender: mockMe,
		type: "text" as const,
		content: "hello world",
		is_deleted: false,
		reply_to: undefined as ChatMessageReference | undefined,
		created_at: "2026-08-20T08:30:00Z",
	},
};

const mockSendMutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: mockMe, isLoading: false }),
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => false,
}));

vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));

vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));

vi.mock("@features/chat/hooks/useChatStream", () => ({
	useChatStream: () => {},
}));

vi.mock("@features/chat/hooks/useChatPushNotifications", () => ({
	useChatPushNotifications: () => ({
		enabled: false,
		supported: true,
		permission: "default",
		busy: false,
		enable: vi.fn(),
		disable: vi.fn(),
		updatePreview: vi.fn(),
	}),
}));

vi.mock("@features/chat/api/queries", () => ({
	useChatConversations: () => ({
		data: { data: [mockConversation], next_cursor: null },
		isLoading: false,
	}),
	useChatContacts: () => ({
		data: {
			pages: [
				{
					data: [mockContact, mockSecondContact],
					pagination: { has_more: false, limit: 50 },
				},
			],
			pageParams: [""],
		},
		isLoading: false,
		isError: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMessages: () => ({
		data: {
			pages: [{ data: [mockConversation.last_message], pagination: { has_more: false } }],
			pageParams: [""],
		},
		isLoading: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMembers: () => ({
		data: mockConversation.members,
		isLoading: false,
	}),
	useCreateChatConversation: () => ({ mutateAsync: mockCreateMutateAsync }),
	useDeleteChatMessage: () => ({ mutate: vi.fn() }),
	useInviteChatMember: () => ({ mutateAsync: vi.fn() }),
	useLeaveChatConversation: () => ({ mutateAsync: vi.fn() }),
	useMarkChatRead: () => ({ mutate: vi.fn() }),
	useRemoveChatMember: () => ({ mutate: vi.fn() }),
	useRenameChatConversation: () => ({ mutateAsync: vi.fn() }),
	useSendChatMessage: () => ({
		mutateAsync: mockSendMutateAsync,
		isPending: false,
	}),
	useSetChatMuted: () => ({ mutate: vi.fn() }),
}));
vi.mock("../api/queries", () => ({
	useChatConversations: () => ({
		data: { data: [mockConversation], next_cursor: null },
		isLoading: false,
	}),
	useChatContacts: () => ({
		data: {
			pages: [
				{
					data: [mockContact, mockSecondContact],
					pagination: { has_more: false, limit: 50 },
				},
			],
			pageParams: [""],
		},
		isLoading: false,
		isError: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMessages: () => ({
		data: {
			pages: [{ data: [mockConversation.last_message], pagination: { has_more: false } }],
			pageParams: [""],
		},
		isLoading: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMembers: () => ({
		data: mockConversation.members,
		isLoading: false,
	}),
	useCreateChatConversation: () => ({ mutateAsync: mockCreateMutateAsync }),
	useDeleteChatMessage: () => ({ mutate: vi.fn() }),
	useInviteChatMember: () => ({ mutateAsync: vi.fn() }),
	useLeaveChatConversation: () => ({ mutateAsync: vi.fn() }),
	useMarkChatRead: () => ({ mutate: vi.fn() }),
	useRemoveChatMember: () => ({ mutate: vi.fn() }),
	useRenameChatConversation: () => ({ mutateAsync: vi.fn() }),
	useSendChatMessage: () => ({
		mutateAsync: mockSendMutateAsync,
		isPending: false,
	}),
	useSetChatMuted: () => ({ mutate: vi.fn() }),
}));

vi.mock("../hooks/useChatStream", () => ({
	useChatStream: () => {},
}));

vi.mock("../hooks/useChatPushNotifications", () => ({
	useChatPushNotifications: () => ({
		enabled: false,
		supported: true,
		permission: "default",
		busy: false,
		enable: vi.fn(),
		disable: vi.fn(),
		updatePreview: vi.fn(),
	}),
}));

vi.mock("../api/queries", () => ({
	useChatConversations: () => ({
		data: { data: [mockConversation], next_cursor: null },
		isLoading: false,
	}),
	useChatContacts: () => ({
		data: {
			pages: [
				{
					data: [mockContact, mockSecondContact],
					pagination: { has_more: false, limit: 50 },
				},
			],
			pageParams: [""],
		},
		isLoading: false,
		isError: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMessages: () => ({
		data: {
			pages: [{ data: [mockConversation.last_message], pagination: { has_more: false } }],
			pageParams: [""],
		},
		isLoading: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn(),
	}),
	useChatMembers: () => ({
		data: mockConversation.members,
		isLoading: false,
	}),
	useCreateChatConversation: () => ({ mutateAsync: mockCreateMutateAsync }),
	useDeleteChatMessage: () => ({ mutate: vi.fn() }),
	useInviteChatMember: () => ({ mutateAsync: vi.fn() }),
	useLeaveChatConversation: () => ({ mutateAsync: vi.fn() }),
	useMarkChatRead: () => ({ mutate: vi.fn() }),
	useRemoveChatMember: () => ({ mutate: vi.fn() }),
	useRenameChatConversation: () => ({ mutateAsync: vi.fn() }),
	useSendChatMessage: () => ({
		mutateAsync: mockSendMutateAsync,
		isPending: false,
	}),
	useSetChatMuted: () => ({ mutate: vi.fn() }),
}));

import { ChatWorkspace } from "../ChatWorkspace";

function createWrapper() {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

describe("ChatWorkspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.HTMLElement.prototype.scrollIntoView = vi.fn();
		window.history.replaceState({}, "", "/chat?c=c_1");
		window.HTMLElement.prototype.scrollTo = vi.fn(function (
			this: HTMLElement,
			optionsOrX?: ScrollToOptions | number,
			y?: number,
		) {
			this.scrollTop = typeof optionsOrX === "number" ? (y ?? 0) : (optionsOrX?.top ?? 0);
		}) as typeof window.HTMLElement.prototype.scrollTo;
	});

	afterEach(() => {
		mockConversation.last_message.reply_to = undefined;
		window.history.replaceState({}, "", "/chat");
		cleanup();
	});

	it("渲染聊天会话列表和主聊天面板", () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		// 侧边栏
		expect(screen.getByText("聊天")).toBeTruthy();
		expect(screen.getByPlaceholderText("搜索会话、用户或群聊")).toBeTruthy();

		// 会话行
		expect(screen.getAllByText("dfy").length).toBeGreaterThan(0);
		expect(screen.getAllByText("hello world").length).toBeGreaterThan(0);
		expect(screen.getByRole("link", { name: "xfy 的个人主页" })).toBeTruthy();
		expect(
			screen.getAllByRole("link", { name: "dfy 的个人主页" }).length,
		).toBeGreaterThanOrEqual(2);
		// 消息输入框与富文本组件（RichCommentInput）
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		expect(editor).toBeTruthy();
		expect(screen.getByRole("button", { name: "发送消息" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "添加表情" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "上传图片" })).toBeTruthy();
	});

	it("聊天用户头像链接到对应的公开个人主页", () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		const profileLinks = screen.getAllByRole("link", { name: "dfy 的个人主页" });
		expect(profileLinks[0]?.getAttribute("href")).toBe("/users/dfy");
	});

	it("输入消息并发送", async () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "新消息测试";
		fireEvent.input(editor);

		const sendBtn = screen.getByRole("button", { name: "发送消息" }) as HTMLButtonElement;
		expect(sendBtn.disabled).toBe(false);
		fireEvent.click(sendBtn);

		expect(mockSendMutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "c_1",
				input: {
					type: "text",
					content: "新消息测试",
				},
			}),
		);
	});

	it("选择消息回复并在发送请求中携带引用", async () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		fireEvent.click(screen.getByRole("button", { name: "回复消息" }));
		expect(screen.getByText("回复 xfy")).toBeTruthy();
		fireEvent.input(screen.getByRole("textbox", { name: "评论内容" }), {
			target: { textContent: "这是回复" },
		});
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

		await waitFor(() => {
			expect(mockSendMutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					input: { type: "text", content: "这是回复", reply_to_id: "m_1" },
				}),
			);
		});
	});

	it("展示引用预览并定位到原消息", async () => {
		mockConversation.last_message.reply_to = {
			id: "m_1",
			sender: mockOtherUser,
			type: "text",
			content: "被引用的内容",
			is_deleted: false,
		};
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		expect(screen.getByText("被引用的内容")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "跳转到dfy的引用消息" }));

		await waitFor(() => {
			expect(screen.getByTestId("chat-message-m_1").className).toContain("ring-2");
		});
	});

	it("发送消息后只滚动消息列表，不滚动外层聊天布局", async () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		const messageScroller = screen.getByTestId("chat-message-list") as HTMLDivElement;
		Object.defineProperties(messageScroller, {
			clientHeight: { configurable: true, value: 300 },
			scrollHeight: { configurable: true, value: 1000 },
		});

		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "滚动目标测试";
		fireEvent.input(editor);
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

		await waitFor(() => {
			expect(messageScroller.scrollTop).toBe(700);
		});
		expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
	});

	it("从统一搜索结果发起私聊", () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		fireEvent.change(screen.getByRole("textbox", { name: "搜索会话、用户或群聊" }), {
			target: { value: "alice" },
		});

		expect(screen.getByText("Alice")).toBeTruthy();
		const profileLink = screen.getByRole("link", { name: "Alice 的个人主页" });
		expect(profileLink.getAttribute("href")).toBe("/users/alice");
		fireEvent.click(screen.getByRole("button", { name: "发起与Alice的私聊" }));

		expect(mockCreateMutateAsync).toHaveBeenCalledWith({
			kind: "direct",
			participant_ids: ["u_contact"],
		});
	});

	it("从新建对话中选择多个成员创建群聊", async () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		fireEvent.click(screen.getByRole("button", { name: "新建会话" }));
		fireEvent.change(screen.getByRole("textbox", { name: "搜索成员" }), {
			target: { value: "a" },
		});
		fireEvent.click(screen.getByRole("button", { name: "选择 Alice" }));
		fireEvent.click(screen.getByRole("button", { name: "选择 Bob" }));
		fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

		await waitFor(() => {
			expect(mockCreateMutateAsync).toHaveBeenCalledWith({
				kind: "room",
				participant_ids: ["u_contact", "u_second_contact"],
			});
			expect(new URL(window.location.href).searchParams.get("c")).toBe("c_2");
		});
	});

	it("未选择会话时显示新建对话引导", () => {
		window.history.replaceState({}, "", "/chat");
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		expect(screen.getByText("选择一个会话")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "新建会话" }).length).toBeGreaterThan(0);
	});

	it("切换会话时同步 URL 并支持返回列表", () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		expect(new URL(window.location.href).searchParams.get("c")).toBe("c_1");
		fireEvent.click(screen.getByRole("button", { name: "返回会话列表" }));

		expect(new URL(window.location.href).searchParams.has("c")).toBe(false);
		expect(screen.getByText("选择一个会话")).toBeTruthy();
	});

	it("私聊会话展示对方头像首字母，而非当前用户自己的头像", () => {
		render(<ChatWorkspace />, { wrapper: createWrapper() });

		// 对方是 dfy，首字母 D；当前用户是 xfy，首字母 X
		// 侧边栏会话项与顶部面板头像应为 D
		const dAvatars = screen.getAllByText("D");
		expect(dAvatars.length).toBeGreaterThanOrEqual(2);

		// 消息列表中 mockConversation.last_message 由 mockMe 发送，消息气泡处才展示 X
		const xAvatars = screen.getAllByText("X");
		expect(xAvatars.length).toBe(1);
	});
});
