/**
 * 铃铛面板与轻提示用的聊天展示数据：会话 → 一行、新消息 → 提示。
 */

import { formatMessageTime } from "@shared/lib/date";
import type { ChatAlertEntry, ChatEntry } from "@shared/ui/message-panel";
import type { ChatConversation, ChatMessage } from "../model/types";
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

/** 提示以发送者为主体：回复了我就直说，房间里带上房间名，私聊只说发来消息。 */
export function toChatAlert(
	conversation: ChatConversation,
	message: ChatMessage,
	currentUserID?: string,
): ChatAlertEntry {
	let action = "发来一条消息";
	if (message.reply_to?.sender.id === currentUserID) {
		action = "回复了你";
	} else if (conversation.kind === "room") {
		action = `在「${conversationLabel(conversation, currentUserID)}」发言`;
	}
	return {
		conversationId: conversation.id,
		name: message.sender.display_name || message.sender.username,
		avatar: message.sender.avatar_url || undefined,
		action,
		preview: messagePreview(message),
	};
}
