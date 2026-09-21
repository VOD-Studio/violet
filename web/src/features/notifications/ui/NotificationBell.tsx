/**
 * NotificationBell - 通知铃铛 + 未读 Badge + 下拉面板
 *
 * 登录用户可见。点击展开下拉通知列表。
 * SSE 实时推送新通知 → Badge 更新；点击通知标记已读并按来源跳转到对应资源，
 * 聊天类通知同时跳转到对应会话。面板底部提供浏览器通知开关。
 */

import type { NotificationItem, NotificationSourceType } from "@shared/api/notifications";
import { formatRelativeTime } from "@shared/lib/date";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import {
	Bell,
	BellRing,
	CheckCheck,
	Heart,
	Inbox,
	Link2,
	MessageCircle,
	MessageCircleReply,
	MessageCircleX,
	MessagesSquare,
	Repeat2,
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
import { useNotificationPushNotifications } from "../hooks/useNotificationPushNotifications";
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
	tweet_liked: Heart,
	tweet_quoted: Repeat2,
	tweet_commented: MessageCircle,
	tweet_comment_replied: MessageCircleReply,
};

/** 推文互动来源：source_id 是推文，点击落到推文详情页 */
const tweetSources: NotificationSourceType[] = [
	"tweet_liked",
	"tweet_quoted",
	"tweet_commented",
	"tweet_comment_replied",
];

/** source_type → 颜色映射：走行为状态与品牌语义（新增/注册=品牌、审核类=warning/success、失败/拒绝=destructive） */
const sourceColor: Record<NotificationSourceType, string> = {
	subscription_failed: "text-destructive",
	subscription_succeeded: "text-success",
	friendlink_applied: "text-warning",
	friendlink_reviewed: "text-success",
	comment_approved: "text-success",
	comment_created: "text-brand",
	comment_pending: "text-warning",
	comment_rejected: "text-destructive",
	user_registered: "text-brand",
	account_security: "text-warning",
	chat_room_invited: "text-neon-cyan",
	tweet_liked: "text-neon-pink",
	tweet_quoted: "text-neon-green",
	tweet_commented: "text-neon-blue",
	tweet_comment_replied: "text-brand",
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

interface NotificationBellProps {
	onOpenChange?: (open: boolean) => void;
}

const NotificationBell = ({ onOpenChange }: NotificationBellProps) => {
	useNotificationStream();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const push = useNotificationPushNotifications();
	const { data: unreadData } = useUnreadCount();
	const { data: notifPage } = useNotifications(1, 10);
	const markRead = useMarkNotificationRead();
	const markAllRead = useMarkAllRead();

	const unread = unreadData?.unread_count ?? 0;
	const items = notifPage?.data ?? [];

	const handleSelect = (item: NotificationItem) => {
		if (!item.is_read) markRead.mutate(item.id);
		if (item.source_type === "chat_room_invited") {
			const conversationID = item.payload?.conversation_id;
			if (typeof conversationID === "string" && conversationID) {
				openChatConversation(conversationID);
			}
			return;
		}
		if (tweetSources.includes(item.source_type) && item.source_id) {
			navigate({ to: "/tweets/$id", params: { id: item.source_id } });
		}
	};

	return (
		<DropdownMenu
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				onOpenChange?.(nextOpen);
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="通知"
					className="relative hover:bg-muted/70 hover:text-foreground"
				>
					{unread > 0 ? <BellRing className="size-4" /> : <Bell className="size-4" />}
					{unread > 0 && (
						<span
							className={cn(
								"absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1",
								"text-[10px] font-bold leading-4 text-destructive-foreground",
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
				{push.enabled && push.supported && (
					<>
						<DropdownMenuSeparator className="m-0" />
						<div className="flex items-center justify-between gap-2 px-4 py-2.5">
							<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
								<Bell className="size-3.5 shrink-0" />
								浏览器通知
							</span>
							<button
								type="button"
								disabled={push.busy}
								onClick={() =>
									push.subscribed ? void push.disable() : void push.enable()
								}
								className={cn(
									"shrink-0 text-xs transition-colors disabled:opacity-60",
									push.subscribed
										? "text-muted-foreground hover:text-foreground"
										: "text-brand hover:underline",
								)}
							>
								{push.busy ? "处理中…" : push.subscribed ? "已开启，关闭" : "开启"}
							</button>
						</div>
					</>
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
					{formatRelativeTime(new Date(item.created_at))}
				</p>
			</div>
			{!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
		</DropdownMenuItem>
	);
};

export default NotificationBell;
