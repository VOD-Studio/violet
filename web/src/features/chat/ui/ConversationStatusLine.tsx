import { resolveOnline, useChatPresenceStore } from "../model/chat-presence-store";
import type { ChatConversation, ChatMember } from "../model/types";

export interface ConversationStatusLineProps {
	conversation: ChatConversation;
	currentUserID: string;
	/** 当前有效成员，含机器人。 */
	members: ChatMember[];
}

/** 会话头部副标题：群聊显示在线人数与在场角色，私信显示对方状态，静音时追加提示。 */
export function ConversationStatusLine({
	conversation,
	currentUserID,
	members,
}: ConversationStatusLineProps) {
	const overrides = useChatPresenceStore((state) => state.overrides);
	const isOnline = (member: ChatMember) =>
		!member.user.is_bot && resolveOnline(overrides, member.user.id, member.online);
	const muted = members.find((member) => member.user.id === currentUserID)?.is_muted === true;
	const parts: string[] = [];

	if (conversation.kind === "room") {
		const roles = members.filter((member) => member.user.is_bot).length;
		parts.push(`${members.filter(isOnline).length} 人在线`);
		if (roles > 0) {
			parts.push(`${roles} 个角色在场`);
		}
	} else {
		const peer = members.find((member) => member.user.id !== currentUserID);
		if (peer?.user.is_bot) {
			parts.push("角色");
		} else {
			parts.push(peer && isOnline(peer) ? "在线" : "离线");
		}
	}
	if (muted) {
		parts.push("已静音");
	}
	return <p className="text-xs leading-4 text-muted-foreground">{parts.join(" · ")}</p>;
}
