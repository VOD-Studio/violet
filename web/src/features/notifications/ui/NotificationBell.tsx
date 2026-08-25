/**
 * NotificationBell - 通知铃铛 + 未读 Badge + 下拉面板
 *
 * 登录用户可见。点击展开下拉通知列表。
 * SSE 实时推送新通知 → Badge 更新；点击通知标记已读，
 * 聊天类通知同时跳转到对应会话。
 */

import type { NotificationItem, NotificationSourceType } from "@shared/api/notifications";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
	Bell,
	BellRing,
	CheckCheck,
	Inbox,
	Link2,
	MessageCircle,
	MessageCircleX,
	MessageSquareText,
	MessagesSquare,
	Rss,
	ShieldCheck,
	UserPlus,
	Users,
} from "lucide-react";
import { useState } from "react";
import {
	useMarkAllRead,
	useMarkNotificationRead,
	useNotifications,
	useUnreadCount,
} from "../api/queries";
import { useNotificationStream } from "../hooks/useNotificationStream";

/** source_type → 图标映射 */
const sourceIcon: Record<NotificationSourceType, typeof Bell> = {
	subscription_failed: Rss,
	subscription_succeeded: Rss,
	friendlink_applied: Users,
	friendlink_reviewed: Link2,
	comment_approved: MessageCircle,
	comment_created: MessageCircle,
	comment_pending: Inbox,
	comment_rejected: MessageCircleX,
	user_registered: UserPlus,
	account_security: ShieldCheck,
	chat_room_invited: MessagesSquare,
	chat_message: MessageSquareText,
};

/** source_type → 颜色映射 */
const sourceColor: Record<NotificationSourceType, string> = {
	subscription_failed: "text-orange-500",
	subscription_succeeded: "text-emerald-500",
	friendlink_applied: "text-blue-500",
	friendlink_reviewed: "text-blue-500",
	comment_approved: "text-emerald-500",
	comment_created: "text-emerald-500",
	comment_pending: "text-amber-500",
	comment_rejected: "text-red-500",
	user_registered: "text-blue-500",
	account_security: "text-purple-500",
	chat_room_invited: "text-neon-cyan",
	chat_message: "text-neon-cyan",
};

/**
 * 跳转到聊天工作区并打开指定会话。
 *
 * 聊天页以 `?c=` 管理选中会话并监听 popstate（useChatSelection）；
 * 直接改 URL 再派发 popstate：已在 /chat 时切换选中，其他页面触发路由匹配挂载。
 */
const openChatConversation = (conversationID: string) => {
	window.history.pushState({}, "", `/chat?c=${encodeURIComponent(conversationID)}`);
	window.dispatchEvent(new PopStateEvent("popstate"));
};

const NotificationBell = () => {
	useNotificationStream();
	const [open, setOpen] = useState(false);
	const { data: unreadData } = useUnreadCount();
	const { data: notifPage } = useNotifications(1, 10);
	const markRead = useMarkNotificationRead();
	const markAllRead = useMarkAllRead();

	const unread = unreadData?.unread_count ?? 0;
	const items = notifPage?.data ?? [];

	const handleSelect = (item: NotificationItem) => {
		if (!item.is_read) markRead.mutate(item.id);
		if (item.source_type === "chat_message" || item.source_type === "chat_room_invited") {
			const conversationID = item.payload?.conversation_id;
			if (typeof conversationID === "string" && conversationID) {
				openChatConversation(conversationID);
			}
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="通知" className="relative">
					{unread > 0 ? <BellRing className="size-4" /> : <Bell className="size-4" />}
					{unread > 0 && (
						<span
							className={cn(
								"absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1",
								"text-[10px] font-bold leading-4 text-white",
							)}
						>
							{unread > 99 ? "99+" : unread}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				sideOffset={10}
				className="w-80 overflow-hidden rounded-xl border-border/40 p-0 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/40"
			>
				<div className="flex items-center justify-between px-4 py-3">
					<span className="text-sm font-semibold">通知</span>
					{unread > 0 && (
						<button
							type="button"
							className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => markAllRead.mutate()}
						>
							<CheckCheck className="size-3" />
							全部已读
						</button>
					)}
				</div>
				<DropdownMenuSeparator className="m-0" />
				{items.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
						<Bell className="size-6 text-muted-foreground/50" />
						<p className="text-xs text-muted-foreground">暂无通知</p>
					</div>
				) : (
					<div className="max-h-96 overflow-y-auto">
						{items.map((item) => (
							<NotificationRow
								key={item.id}
								item={item}
								onSelect={() => handleSelect(item)}
							/>
						))}
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

/** 单条通知行 */
const NotificationRow = ({ item, onSelect }: { item: NotificationItem; onSelect: () => void }) => {
	const Icon = sourceIcon[item.source_type] ?? Bell;
	const color = sourceColor[item.source_type] ?? "text-muted-foreground";

	return (
		<DropdownMenuItem
			className="flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-accent/40"
			onSelect={onSelect}
		>
			<Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
			<div className="min-w-0 flex-1">
				<p className={cn("text-sm", !item.is_read && "font-medium")}>{item.title}</p>
				{item.body && (
					<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
				)}
				<p className="mt-1 text-[10px] text-muted-foreground/70">
					{formatDistanceToNow(new Date(item.created_at), {
						addSuffix: true,
						locale: zhCN,
					})}
				</p>
			</div>
			{!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />}
		</DropdownMenuItem>
	);
};

export default NotificationBell;
