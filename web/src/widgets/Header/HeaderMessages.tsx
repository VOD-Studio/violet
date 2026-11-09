import type { UserDTO } from "@entities/user/model/types";
import { useChatConversations, useChatUnreadCount } from "@features/chat/api/queries";
import { toChatEntry } from "@features/chat/lib/chat-inbox";
import NotificationBell from "@features/notifications/ui/NotificationBell";
import { openChatConversation } from "@shared/lib/open-chat-conversation";
import { listStatus } from "@shared/ui/message-panel";
import { useMemo } from "react";

/** 右药丸里的消息铃铛：通知来自通知 feature，聊天标签的会话与未读来自聊天 feature，在这里合流。 */
const HeaderMessages = ({ user }: { user: UserDTO }) => {
	const conversations = useChatConversations();
	const { data: unread } = useChatUnreadCount();
	const chat = useMemo(
		() => ({
			entries: (conversations.data?.data ?? []).map((item) => toChatEntry(item, user.id)),
			unread: unread?.unread_count ?? 0,
			status: listStatus(conversations.data !== undefined, conversations.isError),
			onSelect: openChatConversation,
			onRetry: () => void conversations.refetch(),
		}),
		[conversations.data, conversations.isError, conversations.refetch, unread, user.id],
	);
	return <NotificationBell chat={chat} />;
};

export default HeaderMessages;
