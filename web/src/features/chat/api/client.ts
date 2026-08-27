import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost } from "@shared/api/request";
import type {
	ChatConversation,
	ChatMember,
	ChatMessage,
	ChatMessageReaction,
	ChatUnreadCount,
	ChatUser,
	CreateConversationInput,
	EditChatMessageInput,
	PushConfig,
	PushSubscriptionInput,
	SendMessageInput,
} from "../model/types";

export const fetchChatConversations = (cursor?: string, limit = 20) =>
	apiGetPaged<ChatConversation>("/chat/conversations", {
		params: { cursor, limit },
	});

export const fetchChatContacts = (query = "", cursor?: string, limit = 50) =>
	apiGetPaged<ChatUser>("/chat/contacts", {
		params: { q: query.trim() || undefined, cursor, limit },
	});

export const fetchChatConversation = (id: string) =>
	apiGet<ChatConversation>(`/chat/conversations/${id}`);

export const fetchChatMembers = (id: string) =>
	apiGet<ChatMember[]>(`/chat/conversations/${id}/members`);

export const fetchChatMessages = (id: string, cursor?: string, limit = 50) =>
	apiGetPaged<ChatMessage>(`/chat/conversations/${id}/messages`, {
		params: { cursor, limit },
	});

export const fetchChatMessageReactions = (conversationID: string, messageID: string) =>
	apiGet<ChatMessageReaction[]>(
		`/chat/conversations/${conversationID}/messages/${messageID}/reactions`,
	);

export const fetchChatUser = (username: string) =>
	apiGet<ChatUser>(`/chat/users/${encodeURIComponent(username)}`);

export const fetchChatUnreadCount = () => apiGet<ChatUnreadCount>("/chat/unread-count");

export const createChatConversation = (input: CreateConversationInput) =>
	apiPost<ChatConversation>("/chat/conversations", input);

export const renameChatConversation = (id: string, title: string) =>
	apiPatch<ChatConversation>(`/chat/conversations/${id}`, { title });

export const inviteChatMember = (id: string, userId: string) =>
	apiPost<null>(`/chat/conversations/${id}/members`, { user_id: userId });
export const removeChatMember = (id: string, userId: string) =>
	apiDelete<null>(`/chat/conversations/${id}/members/${userId}`);

export const setChatMuted = (id: string, muted: boolean) =>
	apiPatch<{ conversation_id: string; is_muted: boolean }>(`/chat/conversations/${id}/mute`, {
		muted,
	});

export const deleteChatMessage = (conversationID: string, messageID: string) =>
	apiDelete<null>(`/chat/conversations/${conversationID}/messages/${messageID}`);
export const editChatMessage = (
	conversationID: string,
	messageID: string,
	input: EditChatMessageInput,
) => apiPatch<ChatMessage>(`/chat/conversations/${conversationID}/messages/${messageID}`, input);

export const leaveChatConversation = (id: string) =>
	apiDelete<null>(`/chat/conversations/${id}/members/me`);

export const sendChatMessage = (id: string, input: SendMessageInput, idempotencyKey: string) =>
	apiPost<ChatMessage>(`/chat/conversations/${id}/messages`, input, {
		headers: { "Idempotency-Key": idempotencyKey },
	});

export const addChatMessageReaction = (
	conversationID: string,
	messageID: string,
	emojiID: number,
) =>
	apiPost<null>(`/chat/conversations/${conversationID}/messages/${messageID}/reactions`, {
		emoji_id: emojiID,
	});

export const removeChatMessageReaction = (
	conversationID: string,
	messageID: string,
	emojiID: number,
) =>
	apiDelete<null>(
		`/chat/conversations/${conversationID}/messages/${messageID}/reactions/${emojiID}`,
	);

export const markChatRead = (id: string, messageId?: string) =>
	apiPost<{ conversation_id: string; unread_count: number }>(`/chat/conversations/${id}/read`, {
		message_id: messageId,
	});

export const setChatTyping = (id: string, isTyping: boolean) =>
	apiPost<null>(`/chat/conversations/${id}/typing`, { is_typing: isTyping });

export const fetchChatPushConfig = () => apiGet<PushConfig>("/chat/push/config");

export const saveChatPushSubscription = (input: PushSubscriptionInput) =>
	apiPost<null>("/chat/push/subscription", input);

export const deleteChatPushSubscription = (endpoint: string) =>
	apiDelete<null>("/chat/push/subscription", { data: { endpoint } });

export const chatEventStreamURL = "/api/v1/chat/events";
