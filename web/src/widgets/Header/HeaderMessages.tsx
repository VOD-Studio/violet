import type { UserDTO } from "@entities/user/model/types";
import { useChatConversations, useChatUnreadCount } from "@features/chat/api/queries";
import { toChatEntry } from "@features/chat/lib/chat-inbox";
import {
	type NotificationPanelData,
	useNotificationPanel,
} from "@features/notifications/hooks/use-notification-panel";
import { openChatConversation } from "@shared/lib/open-chat-conversation";
import { listStatus } from "@shared/ui/message-panel";
import { type ReactNode, useMemo } from "react";

/** 已登录页头的消息数据接入，内容与触发器由同一个胶囊宿主编排。 */
interface HeaderMessagesProps {
	user: UserDTO;
	onNavigate: () => void;
	children: (panel: NotificationPanelData) => ReactNode;
}

const HeaderMessages = ({ user, onNavigate, children }: HeaderMessagesProps) => {
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
	const panel = useNotificationPanel({ chat, onNavigate });
	return children(panel);
};

export default HeaderMessages;
