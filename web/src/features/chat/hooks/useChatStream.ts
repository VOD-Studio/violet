import { useSessionStore } from "@shared/api/session";
import type { PagedResponse } from "@shared/api/types";
import { type InfiniteData, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { chatEventStreamURL } from "../api/client";
import { chatKeys } from "../api/keys";
import { useChatTypingStore } from "../model/chat-typing-store";
import type {
	BotReply,
	ChatConversation,
	ChatEvent,
	ChatMessage,
	ChatTypingEventData,
} from "../model/types";

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
		const latestUpdate = new Map<string, number>();
		const stream = new EventSource(chatEventStreamURL);
		stream.onopen = () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.root });
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
				if (payload.type === "read.advanced") {
					// 已读回执同时刷新消息计数与按需加载的名单；
					// 别人的阅读进度不改变我的会话列表与未读角标，不做全量失效。
					const conversationID = payload.data.conversation_id;
					if (typeof conversationID === "string") {
						queryClient.invalidateQueries({
							queryKey: chatKeys.messages(conversationID),
						});
						queryClient.invalidateQueries({
							queryKey: chatKeys.readers(conversationID),
						});
					}
					return;
				}
				const conversationID = payload.data.conversation_id;
				const messageID = payload.data.message_id;
				const botReply = parseBotReply(payload.data.bot_reply);
				// 自定义表情的映射按查看者计算；仅有正文快照时须回查完整消息。
				if (
					payload.type === "message.updated" &&
					typeof conversationID === "string" &&
					typeof messageID === "string" &&
					typeof payload.data.content === "string" &&
					(typeof payload.data.edited_at === "string" || botReply !== undefined) &&
					!hasCustomEmojiToken(payload.data.content)
				) {
					const sequence = Number(payload.id);
					if (Number.isSafeInteger(sequence) && sequence > 0) {
						const updateKey = `${conversationID}:${messageID}`;
						if (sequence <= (latestUpdate.get(updateKey) ?? 0)) return;
						latestUpdate.set(updateKey, sequence);
						const queryKey = chatKeys.messages(conversationID);
						const content = payload.data.content;
						const editedAt = payload.data.edited_at;
						const cached = queryClient.getQueryData<ChatMessagesCache>(queryKey);
						const hasMessage = cached?.pages.some((page) =>
							page.data.some(
								(message) => message.id === messageID && message.type === "text",
							),
						);
						const ready = hasMessage
							? queryClient.cancelQueries({ queryKey })
							: queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
						void ready
							.then(() => {
								if (latestUpdate.get(updateKey) !== sequence) return;
								let found = false;
								queryClient.setQueryData<ChatMessagesCache>(queryKey, (current) => {
									if (!current) return current;
									const pages = current.pages.map((page) => {
										let pageChanged = false;
										const data = page.data.map((message) => {
											if (message.id !== messageID || message.type !== "text")
												return message;
											found = true;
											pageChanged = true;
											return {
												...message,
												content,
												...(typeof editedAt === "string"
													? { edited_at: editedAt }
													: {}),
												...(botReply ? { bot_reply: botReply } : {}),
											};
										});
										return pageChanged ? { ...page, data } : page;
									});
									return found ? { ...current, pages } : current;
								});
								if (!found) {
									if (hasMessage)
										void queryClient.invalidateQueries({ queryKey });
									return;
								}
								const updateLastMessage = (
									conversation: ChatConversation,
								): ChatConversation =>
									conversation.last_message?.id === messageID
										? {
												...conversation,
												last_message: {
													...conversation.last_message,
													content,
													...(typeof editedAt === "string"
														? { edited_at: editedAt }
														: {}),
													...(botReply ? { bot_reply: botReply } : {}),
												},
											}
										: conversation;
								queryClient.setQueryData<ChatConversation>(
									chatKeys.conversation(conversationID),
									(current) => (current ? updateLastMessage(current) : current),
								);
								queryClient.setQueryData<PagedResponse<ChatConversation>>(
									chatKeys.conversations(),
									(current) => {
										if (!current) return current;
										const data = current.data.map(updateLastMessage);
										return data.some(
											(item, index) => item !== current.data[index],
										)
											? { ...current, data }
											: current;
									},
								);
							})
							.catch(() => queryClient.invalidateQueries({ queryKey }));
						return;
					}
				}
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
						queryClient.invalidateQueries({
							queryKey: chatKeys.botCommands(conversationID),
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

function hasCustomEmojiToken(content: string): boolean {
	return /\[[^\]]+:[0-9a-fA-F-]{36}\]/.test(content);
}

function parseBotReply(value: unknown): BotReply | undefined {
	if (!value || typeof value !== "object") return undefined;
	const reply = value as Record<string, unknown>;
	if (
		typeof reply.status !== "string" ||
		!["pending", "thinking", "streaming", "completed", "failed"].includes(reply.status) ||
		typeof reply.revision !== "number" ||
		typeof reply.updated_at !== "string"
	)
		return undefined;
	return reply as unknown as BotReply;
}
