/**
 * 铃铛面板用的聊天展示数据：会话 → 一行。
 */

import { formatMessageTime } from "@shared/lib/date";
import type { ChatEntry } from "@shared/ui/message-panel";
import type { ChatConversation } from "../model/types";
import { conversationLabel, conversationTargetUser, messagePreview } from "./conversation";

export function toChatEntry(conversation: ChatConversation, currentUserID?: string): ChatEntry {
	const last = conversation.last_message;
	return {
		id: conversation.id,
		name: conversationLabel(conversation, currentUserID),
		avatar: conversationTargetUser(conversation, currentUserID).avatar_url || undefined,
		preview: last ? messagePreview(last) : "还没有消息",
		time: formatMessageTime(last?.created_at ?? conversation.updated_at),
		unread: conversation.unread_count,
	};
}
