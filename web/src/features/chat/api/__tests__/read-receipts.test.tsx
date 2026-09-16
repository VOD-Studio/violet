import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatUnreadTitle } from "../../hooks/use-chat-unread-title";
import { useChatStream } from "../../hooks/useChatStream";
import type { ChatMessage } from "../../model/types";
import { fetchChatUnreadCount, markChatRead, sendChatMessage } from "../client";
import { chatKeys } from "../keys";
import { useChatUnreadCount, useMarkChatRead, useSendChatMessage } from "../queries";

vi.mock("../client", () => ({
	sendChatMessage: vi.fn(),
	fetchChatUnreadCount: vi.fn(),
	markChatRead: vi.fn(),
	chatEventStreamURL: "/chat/events",
}));
vi.mock("@shared/api/session", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@shared/api/session")>();
	actual.useSessionStore.setState({ sessionActive: true });
	return actual;
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	document.title = "";
});

it("新消息经 SSE 刷新标签页未读提示，阅读成功后恢复原标题", async () => {
	const { qc, wrapper } = setup();
	const listeners = new Map<string, (event: MessageEvent) => void>();
	vi.stubGlobal(
		"EventSource",
		class {
			addEventListener(name: string, callback: (event: MessageEvent) => void) {
				listeners.set(name, callback);
			}
			close() {}
		},
	);
	vi.mocked(fetchChatUnreadCount).mockResolvedValue({ unread_count: 0 });
	vi.mocked(markChatRead).mockResolvedValue({ conversation_id: "c1", unread_count: 0 });
	document.title = "Violet";
	const { result, rerender, unmount } = renderHook(
		({ loggedIn }) => {
			const { data } = useChatUnreadCount(loggedIn);
			useChatUnreadTitle(loggedIn ? (data?.unread_count ?? 0) : 0);
			useChatStream();
			return useMarkChatRead();
		},
		{ wrapper, initialProps: { loggedIn: true } },
	);
	await waitFor(() => expect(qc.getQueryState(chatKeys.unreadCount())?.status).toBe("success"));
	expect(document.title).toBe("Violet");
	vi.mocked(fetchChatUnreadCount).mockResolvedValue({ unread_count: 3 });
	act(() => {
		listeners.get("chat")?.(
			new MessageEvent("chat", {
				data: JSON.stringify({ type: "message.created", data: { conversation_id: "c1" } }),
			}),
		);
	});
	await waitFor(() => expect(document.title).toBe("(3 条未读) Violet"));
	rerender({ loggedIn: false });
	expect(document.title).toBe("Violet");
	rerender({ loggedIn: true });
	await waitFor(() => expect(document.title).toBe("(3 条未读) Violet"));
	vi.mocked(fetchChatUnreadCount).mockResolvedValue({ unread_count: 0 });
	await act(() => result.current.mutateAsync({ id: "c1", messageId: "m1" }));
	await waitFor(() => expect(document.title).toBe("Violet"));
	unmount();
	qc.clear();
});

function setup() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
	return { qc, wrapper };
}

it("发送响应晚于已读刷新时保留最新回执且不插入重复消息", async () => {
	const { qc, wrapper } = setup();
	const message = {
		id: "m1",
		conversation_id: "c1",
		read_state: { read_count: 1, member_count: 1 },
	} as ChatMessage;
	const page = { data: [message], pagination: { has_more: false } };
	qc.setQueryData(chatKeys.messages("c1"), { pages: [page], pageParams: [""] });
	vi.mocked(sendChatMessage).mockResolvedValue({
		...message,
		read_state: { read_count: 0, member_count: 1 },
	});
	const { result } = renderHook(useSendChatMessage, { wrapper });
	await act(async () => {
		await result.current.mutateAsync({
			id: "c1",
			input: { type: "text", content: "hello" },
			idempotencyKey: "k",
			draft: {
				sender: { id: "self", username: "self", display_name: "Self", avatar_url: "" },
			},
		});
	});
	const data = qc.getQueryData<{ pages: (typeof page)[] }>(chatKeys.messages("c1"));
	expect(data?.pages.flatMap((p) => p.data)).toEqual([message]);
});

it("已读事件同时失效计数与已读名单，重连重新核对消息", () => {
	const { qc, wrapper } = setup();
	const listeners = new Map<string, (event: MessageEvent) => void>();
	let stream: { onopen?: () => void };
	vi.stubGlobal(
		"EventSource",
		class {
			onopen?: () => void;
			constructor() {
				stream = this;
			}
			addEventListener(name: string, callback: (event: MessageEvent) => void) {
				listeners.set(name, callback);
			}
			close() {}
		},
	);
	qc.setQueryData(chatKeys.messages("c1"), {});
	qc.setQueryData(chatKeys.messageReaders("c1", "m1"), []);
	renderHook(useChatStream, { wrapper });
	act(() =>
		listeners.get("chat")?.(
			new MessageEvent("chat", {
				data: JSON.stringify({ type: "read.advanced", data: { conversation_id: "c1" } }),
			}),
		),
	);
	expect(qc.getQueryState(chatKeys.messages("c1"))?.isInvalidated).toBe(true);
	expect(qc.getQueryState(chatKeys.messageReaders("c1", "m1"))?.isInvalidated).toBe(true);
	qc.setQueryData(chatKeys.messages("c1"), {});
	act(() => stream.onopen?.());
	expect(qc.getQueryState(chatKeys.messages("c1"))?.isInvalidated).toBe(true);
});
