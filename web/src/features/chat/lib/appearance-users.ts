import type { ChatConversation, ChatMember, ChatMessage } from "../model/types";
import { normalizeAppearanceUserIDs } from "./appearance";

/** 覆盖会话主、已知成员与最后发送者,供会话列表头像查询。 */
export function conversationAppearanceUserIDs(
	conversations: readonly ChatConversation[],
): string[] {
	return normalizeAppearanceUserIDs(
		conversations.flatMap((conversation) => [
			conversation.owner.id,
			...(conversation.members ?? []).map((member) => member.user.id),
			conversation.last_message?.sender.id ?? "",
		]),
	);
}

/** 已加载的历史发送者也计入,即使其已离开会话。 */
export function panelAppearanceUserIDs(
	conversation: ChatConversation,
	members: readonly ChatMember[],
	messages: readonly ChatMessage[],
): string[] {
	return normalizeAppearanceUserIDs([
		...conversationAppearanceUserIDs([conversation]),
		...members.map((member) => member.user.id),
		...messages.map((message) => message.sender.id),
	]);
}
