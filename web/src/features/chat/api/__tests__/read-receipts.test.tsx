import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatStream } from "../../hooks/useChatStream";
import type { ChatMessage } from "../../model/types";
import { sendChatMessage } from "../client";
import { chatKeys } from "../keys";
import { useSendChatMessage } from "../queries";

vi.mock("../client", () => ({ sendChatMessage: vi.fn(), chatEventStreamURL: "/chat/events" }));
vi.mock("@shared/api/session", () => ({ useSessionStore: () => true }));
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
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
