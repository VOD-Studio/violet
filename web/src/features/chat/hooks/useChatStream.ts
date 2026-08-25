import { useSessionStore } from "@shared/api/session";
import type { PagedResponse } from "@shared/api/types";
import { type InfiniteData, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { chatEventStreamURL } from "../api/client";
import { chatKeys } from "../api/keys";
import { useChatTypingStore } from "../model/chat-typing-store";
import type { ChatEvent, ChatMessage, ChatTypingEventData } from "../model/types";

type ChatMessagesCache = InfiniteData<PagedResponse<ChatMessage>, unknown>;

function mergeCustomEmote(
	queryClient: QueryClient,
	conversationID: string,
	messageID: string,
	customEmote: NonNullable<ChatEvent["custom_emote"]>,
) {
	queryClient.setQueryData<ChatMessagesCache>(chatKeys.messages(conversationID), (current) => {
		if (!current) return current;
		let changed = false;
		const pages = current.pages.map((page) => {
			const data = page.data.map((message) => {
				if (message.id !== messageID) return message;
				changed = true;
				return { ...message, custom_emote: customEmote };
			});
			return changed ? { ...page, data } : page;
		});
		return changed ? { ...current, pages } : current;
	});
}

/**
 * 建立聊天 SSE 事件流，断线由浏览器自动重连并携带 Last-Event-ID。
 *
 * 挂载在站点 Header（登录即建连），聊天图标未读角标全站实时；
 * 房间邀请的 toast 由通知铃铛的 SSE 通道统一弹出，这里不再重复。
 */
export const useChatStream = () => {
	const queryClient = useQueryClient();
	const sessionActive = useSessionStore((state) => state.sessionActive);

	useEffect(() => {
		if (!sessionActive || typeof window === "undefined") return;
		const stream = new EventSource(chatEventStreamURL);
		stream.onopen = () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
			queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
		};
		stream.addEventListener("chat", (event) => {
			try {
				const payload = JSON.parse((event as MessageEvent).data) as ChatEvent;
				if (payload.type === "typing.updated") {
					// 瞬态事件：不进事件表持久化，不参与断线补发（见 CONTEXT.md「输入状态」词条），
					// 只驱动展示状态，不触发任何查询失效。
					const data = payload.data as unknown as ChatTypingEventData;
					if (data.is_typing) {
						useChatTypingStore.getState().setTyping(data.conversation_id, data.user_id);
					} else {
						useChatTypingStore
							.getState()
							.clearTyping(data.conversation_id, data.user_id);
					}
					return;
				}
				const conversationID = payload.data.conversation_id;
				const messageID = payload.data.message_id;
				if (
					payload.type === "message.created" &&
					typeof conversationID === "string" &&
					typeof messageID === "string" &&
					payload.custom_emote
				) {
					mergeCustomEmote(queryClient, conversationID, messageID, payload.custom_emote);
				}
				queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
				queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
				if (typeof conversationID === "string") {
					queryClient.invalidateQueries({
						queryKey: chatKeys.conversation(conversationID),
					});
					queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationID) });
					if (payload.type === "member.changed") {
						queryClient.invalidateQueries({
							queryKey: chatKeys.members(conversationID),
						});
					}
				}
			} catch {
				// 畸形事件交给下一次对账请求恢复。
			}
		});
		return () => stream.close();
	}, [queryClient, sessionActive]);
};
