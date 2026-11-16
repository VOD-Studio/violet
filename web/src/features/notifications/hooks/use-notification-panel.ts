import type { NotificationSourceType } from "@shared/api/notifications";
import { openChatConversation } from "@shared/lib/open-chat-conversation";
import {
	listStatus,
	type MessagePanelChat,
	type MessagePanelProps,
} from "@shared/ui/message-panel";
import { RouterLink } from "@shared/ui/site-navbar";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	useMarkAllRead,
	useMarkNotificationRead,
	useNotifications,
	useUnreadCount,
} from "../api/queries";
import { toNoticeEntry } from "../lib/notice-entry";
import { useNotificationPushNotifications } from "./useNotificationPushNotifications";
import { useNotificationStream } from "./useNotificationStream";

const tweetSources: NotificationSourceType[] = [
	"tweet_liked",
	"tweet_quoted",
	"tweet_commented",
	"tweet_comment_replied",
];

/** 消息展示所需的数据与动作，不持有弹层或标签状态。 */
export interface NotificationPanelData extends Omit<MessagePanelProps, "tab" | "onTabChange"> {
	/** 通知与聊天未读数之和，供宿主徽标使用。 */
	unread: number;
}

/** 通知面板与宿主导航、聊天数据的接入契约。 */
export interface NotificationPanelOptions {
	/** 导航前同步收起宿主面板；标记已读不会调用。 */
	onNavigate: () => void;
	/** 省略时只显示通知；聊天室链接由通知模块接入路由。 */
	chat?: Omit<MessagePanelChat, "LinkComponent">;
}

/** 订阅通知并组装消息内容，弹层形态与开合由消费方负责。 */
export function useNotificationPanel({
	onNavigate,
	chat,
}: NotificationPanelOptions): NotificationPanelData {
	useNotificationStream();
	const navigate = useNavigate();
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
				onNavigate();
				openChatConversation(conversationID);
			}
			return;
		}
		if (tweetSources.includes(item.source_type) && item.source_id) {
			onNavigate();
			navigate({ to: "/tweets/$id", params: { id: item.source_id } });
			return;
		}
		const announcementID = item.payload?.announcement_id;
		if (item.source_type === "announcement" && typeof announcementID === "number") {
			onNavigate();
			navigate({ to: "/announcements/$id", params: { id: String(announcementID) } });
		}
	};

	return {
		unread: unread + (chat?.unread ?? 0),
		notices: entries,
		noticeUnread: unread,
		status: listStatus(items !== undefined, notifications.isError),
		onRetry: () => void notifications.refetch(),
		onSelectNotice: handleSelect,
		onReadAll: () => markAllRead.mutate(),
		push:
			push.enabled && push.supported
				? {
						checked: push.subscribed === true,
						busy: push.busy,
						onChange: (next) => void (next ? push.enable() : push.disable()),
					}
				: undefined,
		chat: chat && {
			...chat,
			onSelect: (id) => {
				onNavigate();
				chat.onSelect(id);
			},
			LinkComponent: RouterLink,
		},
	};
}
