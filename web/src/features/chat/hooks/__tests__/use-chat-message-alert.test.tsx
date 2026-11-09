import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatKeys } from "../../api/keys";
import { useChatAlertStore } from "../../model/chat-alert-store";
import type { ChatConversation, ChatMessage, ChatUser } from "../../model/types";
import { useChatMessageAlert } from "../use-chat-message-alert";

const ME: ChatUser = { id: "me", username: "xunrua", display_name: "xunrua", avatar_url: "" };
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

function conversation(muted = false): ChatConversation {
	return {
		id: "c1",
		kind: "direct",
		title: "",
		owner: ME,
		members: [
			{ user: ME, role: "owner", joined_at: "", is_muted: muted },
			{ user: CLAUDE, role: "member", joined_at: "", is_muted: false },
		],
		last_message: MESSAGE,
		unread_count: 1,
		created_at: "2026-11-01T00:00:00Z",
		updated_at: "2026-11-09T09:58:00+08:00",
	};
}

function setup(options: { inChatRoom?: boolean; muted?: boolean } = {}) {
	// staleTime 无限：会话列表只用测试种下的数据，不去请求网络
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
	});
	const page: PagedResponse<ChatConversation> = {
		data: [conversation(options.muted)],
		pagination: { limit: 20 },
	};
	client.setQueryData(chatKeys.conversations(), page);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return renderHook(
		(props: { inChatRoom: boolean }) =>
			useChatMessageAlert({ currentUserID: ME.id, inChatRoom: props.inChatRoom }),
		{ wrapper, initialProps: { inChatRoom: options.inChatRoom ?? false } },
	);
}

const raise = (senderID = CLAUDE.id) =>
	act(() => {
		useChatAlertStore.getState().raise({ conversationID: "c1", messageID: "m1", senderID });
	});

describe("useChatMessageAlert", () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});
	afterEach(() => {
		cleanup();
		useChatAlertStore.getState().clear();
		vi.useRealTimers();
	});

	it("不在聊天室时，别人的新消息弹出轻提示，几秒后自行收起", async () => {
		const { result } = setup();
		raise();
		await waitFor(() => expect(result.current.alert?.name).toBe("Claude"));
		expect(result.current.alert?.preview).toBe("摘要已经整理好了");
		act(() => {
			vi.advanceTimersByTime(5100);
		});
		expect(result.current.alert).toBeNull();
	});

	it("在聊天室内新消息不弹提示；离开聊天室后也不补弹", async () => {
		const { result, rerender } = setup({ inChatRoom: true });
		raise();
		await act(async () => {});
		expect(result.current.alert).toBeNull();
		rerender({ inChatRoom: false });
		expect(result.current.alert).toBeNull();
	});

	it("自己发的消息不弹提示", async () => {
		const { result } = setup();
		raise(ME.id);
		await act(async () => {});
		expect(result.current.alert).toBeNull();
	});

	it("静音会话不弹提示", async () => {
		const { result } = setup({ muted: true });
		raise();
		await act(async () => {});
		expect(result.current.alert).toBeNull();
	});

	it("悬停期间暂停计时，移开后重新计时", async () => {
		const { result } = setup();
		raise();
		await waitFor(() => expect(result.current.alert).not.toBeNull());
		act(() => result.current.setPaused(true));
		act(() => {
			vi.advanceTimersByTime(20_000);
		});
		expect(result.current.alert).not.toBeNull();
		act(() => result.current.setPaused(false));
		act(() => {
			vi.advanceTimersByTime(5100);
		});
		expect(result.current.alert).toBeNull();
	});

	it("点回复进入该会话并收起提示", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const { result } = setup();
		raise();
		await waitFor(() => expect(result.current.alert).not.toBeNull());
		act(() => result.current.reply());
		expect(pushState).toHaveBeenCalledWith({}, "", "/chat?c=c1");
		expect(result.current.alert).toBeNull();
		pushState.mockRestore();
	});
});
