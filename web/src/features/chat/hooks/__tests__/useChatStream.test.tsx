import { useSessionStore } from "@shared/api/session";
import type { PagedResponse } from "@shared/api/types";
import {
	type InfiniteData,
	QueryClient,
	QueryClientProvider,
	QueryObserver,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { chatKeys } from "../../api/keys";
import type { ChatConversation, ChatMessage } from "../../model/types";
import { useChatStream } from "../useChatStream";

type MessagesCache = InfiniteData<PagedResponse<ChatMessage>>;

const message: ChatMessage = {
	id: "m1",
	conversation_id: "c1",
	sender: { id: "bot", username: "bot", display_name: "Bot", avatar_url: "" },
	type: "text",
	content: "占位",
	reactions: [],
	is_deleted: false,
	created_at: "2026-09-23T10:00:00Z",
};

function cacheWith(content: string): MessagesCache {
	return {
		pages: [{ data: [{ ...message, content }], pagination: { limit: 50 } }],
		pageParams: [""],
	};
}

function setupStream() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
	useSessionStore.setState({ sessionActive: true });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	const emit = (id: string, data: Record<string, unknown>) => {
		listeners.get("chat")?.(
			new MessageEvent("chat", {
				data: JSON.stringify({ id, type: "message.updated", data }),
			}),
		);
	};
	return { client, wrapper, emit };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	useSessionStore.setState({ sessionActive: false });
});

it("连续正文快照更新同一气泡，旧帧不会倒退，也不逐段失效查询", async () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	client.setQueryData(key, cacheWith("占位"));
	client.setQueryData(chatKeys.messages("c2"), cacheWith("其他会话"));
	const conversation: ChatConversation = {
		id: "c1",
		kind: "direct",
		title: "",
		owner: message.sender,
		last_message: message,
		unread_count: 0,
		created_at: message.created_at,
		updated_at: message.created_at,
	};
	client.setQueryData(chatKeys.conversations(), {
		data: [conversation],
		pagination: { limit: 20 },
	});
	client.setQueryData(chatKeys.conversation("c1"), conversation);
	const invalidate = vi.spyOn(client, "invalidateQueries");
	renderHook(useChatStream, { wrapper });
	for (const [id, content] of [
		["1", "第一段"],
		["2", "第一段第二段"],
		["3", "完整回复"],
	]) {
		act(() =>
			emit(id, {
				conversation_id: "c1",
				message_id: "m1",
				content,
				edited_at: "2026-09-23T10:00:01Z",
			}),
		);
		await waitFor(() =>
			expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe(content),
		);
	}
	act(() =>
		emit("2", {
			conversation_id: "c1",
			message_id: "m1",
			content: "过期片段",
			edited_at: "2026-09-23T10:00:01Z",
		}),
	);
	expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe("完整回复");
	expect(
		client.getQueryData<MessagesCache>(chatKeys.messages("c2"))?.pages[0].data[0].content,
	).toBe("其他会话");
	expect(
		client.getQueryData<PagedResponse<ChatConversation>>(chatKeys.conversations())?.data[0]
			.last_message?.content,
	).toBe("完整回复");
	expect(
		client.getQueryData<ChatConversation>(chatKeys.conversation("c1"))?.last_message?.content,
	).toBe("完整回复");
	expect(invalidate).not.toHaveBeenCalled();
});

it("缺少正文快照时回查消息", () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	client.setQueryData(key, cacheWith("旧正文"));
	renderHook(useChatStream, { wrapper });
	act(() => emit("4", { conversation_id: "c1", message_id: "m1" }));
	expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});

it("Bot 生成快照同步正文、thinking 与完成状态", async () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	client.setQueryData(key, cacheWith(""));
	renderHook(useChatStream, { wrapper });
	for (const [id, status, content] of [
		["1", "thinking", ""],
		["2", "streaming", "第一段"],
		["3", "completed", "最终回复"],
	]) {
		act(() =>
			emit(id, {
				conversation_id: "c1",
				message_id: "m1",
				content,
				bot_reply: {
					status,
					thinking: "已分析",
					revision: Number(id),
					updated_at: "2026-09-23T10:00:01Z",
				},
			}),
		);
		await waitFor(() =>
			expect(
				client.getQueryData<MessagesCache>(key)?.pages[0].data[0].bot_reply?.status,
			).toBe(status),
		);
	}
	const result = client.getQueryData<MessagesCache>(key)?.pages[0].data[0];
	expect(result?.content).toBe("最终回复");
	expect(result?.bot_reply?.thinking).toBe("已分析");
	expect(result?.edited_at).toBeUndefined();
});

it("含自定义表情的编辑回查按查看者解析的映射", () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	client.setQueryData(key, cacheWith("旧正文"));
	renderHook(useChatStream, { wrapper });
	act(() =>
		emit("4", {
			conversation_id: "c1",
			message_id: "m1",
			content: "[cat:30000000-0000-0000-0000-000000000003]",
			edited_at: "2026-09-23T10:00:01Z",
		}),
	);
	expect(client.getQueryState(key)?.isInvalidated).toBe(true);
	expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe("旧正文");
});

it("取消在途的旧查询后应用实时正文", async () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	client.setQueryData(key, cacheWith("占位"));
	renderHook(useChatStream, { wrapper });
	let release: (value: MessagesCache) => void = () => {};
	let aborted = false;
	const pending = client.fetchQuery({
		queryKey: key,
		queryFn: ({ signal }) =>
			new Promise<MessagesCache>((resolve) => {
				release = resolve;
				signal.addEventListener("abort", () => {
					aborted = true;
				});
			}),
	});
	act(() =>
		emit("5", {
			conversation_id: "c1",
			message_id: "m1",
			content: "新正文",
			edited_at: "2026-09-23T10:00:02Z",
		}),
	);
	await waitFor(() => expect(aborted).toBe(true));
	await waitFor(() =>
		expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe("新正文"),
	);
	release(cacheWith("过期响应"));
	await pending.catch(() => {});
	expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe("新正文");
});

it("首轮消息查询未完成时保留查询并应用最新片段", async () => {
	const { client, wrapper, emit } = setupStream();
	const key = chatKeys.messages("c1");
	let release: ((value: MessagesCache) => void) | undefined;
	let aborted = false;
	let reads = 0;
	const observer = new QueryObserver(client, {
		queryKey: key,
		queryFn: ({ signal }) => {
			reads++;
			return new Promise<MessagesCache>((resolve) => {
				release = resolve;
				signal.addEventListener("abort", () => {
					aborted = true;
				});
			});
		},
	});
	const unsubscribe = observer.subscribe(() => {});
	renderHook(useChatStream, { wrapper });
	for (const [id, content] of [
		["1", "第一段"],
		["2", "第一段第二段"],
		["3", "完整回复"],
	]) {
		act(() =>
			emit(id, {
				conversation_id: "c1",
				message_id: "m1",
				content,
				edited_at: "2026-09-23T10:00:01Z",
			}),
		);
	}
	expect(aborted).toBe(false);
	expect(reads).toBe(1);
	release?.(cacheWith("占位"));
	await waitFor(() =>
		expect(client.getQueryData<MessagesCache>(key)?.pages[0].data[0].content).toBe("完整回复"),
	);
	unsubscribe();
});
