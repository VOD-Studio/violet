import { openChatConversation } from "@shared/lib/open-chat-conversation";
import type { ChatAlertEntry } from "@shared/ui/message-panel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatConversations } from "../api/queries";
import { toChatAlert } from "../lib/chat-inbox";
import { useChatAlertStore } from "../model/chat-alert-store";

/** 轻提示停留多久后收进铃铛角标。 */
const ALERT_DURATION = 5000;

interface ChatMessageAlertOptions {
	currentUserID?: string;
	/** 正在聊天室里：新消息直接出现在会话中，不再弹提示。 */
	inChatRoom: boolean;
}

/**
 * 新聊天消息的轻提示：别人发来的消息、人不在聊天室、会话没静音时出现，
 * 几秒后自行收起（未读仍在铃铛角标里）；悬停或聚焦期间暂停计时。
 *
 * 消息正文来自会话列表：事件流只带 ID，等列表刷新到该条之后才出现提示。
 */
export function useChatMessageAlert({ currentUserID, inChatRoom }: ChatMessageAlertOptions) {
	const incoming = useChatAlertStore((state) => state.incoming);
	const clear = useChatAlertStore((state) => state.clear);
	const conversations = useChatConversations(Boolean(currentUserID));
	const [paused, setPaused] = useState(false);

	const alert: ChatAlertEntry | null = useMemo(() => {
		if (!incoming || inChatRoom || !currentUserID || incoming.senderID === currentUserID) {
			return null;
		}
		const conversation = conversations.data?.data.find(
			(item) => item.id === incoming.conversationID,
		);
		const message = conversation?.last_message;
		if (!conversation || message?.id !== incoming.messageID) return null;
		const muted = conversation.members?.find(
			(member) => member.user.id === currentUserID,
		)?.is_muted;
		return muted ? null : toChatAlert(conversation, message, currentUserID);
	}, [incoming, inChatRoom, currentUserID, conversations.data]);

	// 在聊天室里到达的消息作废：离开聊天室后不补弹
	useEffect(() => {
		if (inChatRoom && incoming) clear();
	}, [inChatRoom, incoming, clear]);

	// 计时只跟「有没有提示」「是否暂停」「是不是新的一条」走：会话列表刷新不重置倒计时
	const visible = alert !== null;
	// 提示在指针悬停时被收走（如进入聊天室）不会再有 pointerleave，暂停状态在这里复位
	useEffect(() => {
		if (!visible) setPaused(false);
	}, [visible]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: incoming 换新时要重新计时
	useEffect(() => {
		if (!visible || paused) return;
		const timer = setTimeout(clear, ALERT_DURATION);
		return () => clearTimeout(timer);
	}, [visible, paused, incoming, clear]);

	const reply = useCallback(() => {
		if (!alert) return;
		openChatConversation(alert.conversationId);
		clear();
	}, [alert, clear]);

	return { alert, reply, setPaused };
}
