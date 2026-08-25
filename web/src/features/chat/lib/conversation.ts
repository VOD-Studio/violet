/**
 * 会话展示辅助：会话命名、对方解析与消息预览/时间格式化。
 */
import type { ChatConversation, ChatMessage } from "../model/types";

export function conversationLabel(conversation: ChatConversation, currentUserID?: string) {
	if (conversation.title) return conversation.title;
	const participants =
		conversation.members?.filter((member) => member.user.id !== currentUserID) ?? [];
	if (conversation.kind === "direct") {
		return participants[0]?.user.display_name ?? conversation.owner.display_name;
	}
	return (
		participants.map((member) => member.user.display_name).join("、") ||
		conversation.owner.display_name
	);
}

export function conversationTargetUser(
	conversation: ChatConversation,
	currentUserID?: string,
): ChatConversation["owner"] {
	if (conversation.kind === "direct") {
		const participant = conversation.members?.find(
			(member) => member.user.id !== currentUserID,
		);
		if (participant) return participant.user;
		if (conversation.owner.id !== currentUserID) return conversation.owner;
	}
	return conversation.owner;
}

export function messagePreview(message: ChatMessage) {
	if (message.is_deleted) return "消息已删除";
	if (message.type === "image") return message.content || "发送了一张图片";
	if (message.type === "tweet_share") return message.content || "分享了一条推文";
	return message.content ?? "";
}

export function formatTime(value: string) {
	return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
		new Date(value),
	);
}

export function formatDate(value: string) {
	return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(
		new Date(value),
	);
}

export function formatRelativeTime(value: string) {
	const date = new Date(value);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return formatTime(value);
	}
	if (diffDays === 1) {
		return "昨天";
	}
	if (diffDays < 7) {
		return `${diffDays}天前`;
	}
	return `${date.getMonth() + 1}/${date.getDate()}`;
}
