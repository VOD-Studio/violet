/**
 * NotificationBell - 通知铃铛：未读角标与消息面板的接线，取通知数据、处理已读与跳转。
 * 聊天标签的数据由宿主以 `chat` 传入。
 */

import type { NotificationSourceType } from "@shared/api/notifications";
import { openChatConversation } from "@shared/lib/open-chat-conversation";
import { listStatus, MessageCenter, type MessagePanelChat } from "@shared/ui/message-panel";
import { RouterLink } from "@shared/ui/site-navbar";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	useMarkAllRead,
	useMarkNotificationRead,
	useNotifications,
	useUnreadCount,
} from "../api/queries";
import { useNotificationPushNotifications } from "../hooks/useNotificationPushNotifications";
import { useNotificationStream } from "../hooks/useNotificationStream";
import { toNoticeEntry } from "../lib/notice-entry";

/** 推文互动来源：source_id 是推文，点击落到推文详情页 */
const tweetSources: NotificationSourceType[] = [
	"tweet_liked",
	"tweet_quoted",
	"tweet_commented",
	"tweet_comment_replied",
];

/** 聊天标签的数据与动作；「进入聊天室」的链接组件由铃铛统一指定。 */
export type NotificationBellChat = Omit<MessagePanelChat, "LinkComponent">;

interface NotificationBellProps {
	/** 聊天标签；省略时面板只有通知（后台）。 */
	chat?: NotificationBellChat;
}

const NotificationBell = ({ chat }: NotificationBellProps) => {
	useNotificationStream();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const push = useNotificationPushNotifications();
	const { data: unreadData } = useUnreadCount();
	const notifications = useNotifications(1, 10);
	const markRead = useMarkNotificationRead();
	const markAllRead = useMarkAllRead();

	const unread = unreadData?.unread_count ?? 0;
	const items = notifications.data?.data;
	const entries = useMemo(() => (items ?? []).map(toNoticeEntry), [items]);

	const handleSelect = (id: string) => {
		const item = items?.find((candidate) => candidate.id === id);
		if (!item) return;
		if (!item.is_read) markRead.mutate(item.id);
		if (item.source_type === "chat_room_invited") {
			const conversationID = item.payload?.conversation_id;
			if (typeof conversationID === "string" && conversationID) {
				setOpen(false);
				openChatConversation(conversationID);
			}
			return;
		}
		if (tweetSources.includes(item.source_type) && item.source_id) {
			setOpen(false);
			navigate({ to: "/tweets/$id", params: { id: item.source_id } });
			return;
		}
		const announcementID = item.payload?.announcement_id;
		if (item.source_type === "announcement" && typeof announcementID === "number") {
			setOpen(false);
			navigate({ to: "/announcements/$id", params: { id: String(announcementID) } });
		}
	};

	return (
		<MessageCenter
			open={open}
			onOpenChange={setOpen}
			unread={unread + (chat?.unread ?? 0)}
			notices={entries}
			noticeUnread={unread}
			status={listStatus(items !== undefined, notifications.isError)}
			onRetry={() => void notifications.refetch()}
			onSelectNotice={handleSelect}
			onReadAll={() => markAllRead.mutate()}
			push={
				push.enabled && push.supported
					? {
							checked: push.subscribed === true,
							busy: push.busy,
							onChange: (next) => void (next ? push.enable() : push.disable()),
						}
					: undefined
			}
			chat={
				chat && {
					...chat,
					onSelect: (id) => {
						setOpen(false);
						chat.onSelect(id);
					},
					LinkComponent: RouterLink,
				}
			}
		/>
	);
};

export default NotificationBell;
