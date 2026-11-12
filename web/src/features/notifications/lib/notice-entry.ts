import type { NotificationItem, NotificationSourceType } from "@shared/api/notifications";
import { formatMessageTime } from "@shared/lib/date";
import type { NoticeEntry } from "@shared/ui/message-panel";
import { isSameDay } from "date-fns";
import {
	Bell,
	Hand,
	Heart,
	Inbox,
	Link2,
	type LucideIcon,
	Megaphone,
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

const SOURCE_ICON: Record<NotificationSourceType, LucideIcon> = {
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
	window_knocked: Hand,
	announcement: Megaphone,
};

/** 带行为人时「做了什么」的句式；没有句式的类型整句取标题。 */
const ACTION: Partial<Record<NotificationSourceType, (object?: string) => string>> = {
	comment_created: (object) => (object ? `评论了你的文章《${object}》` : "评论了你的文章"),
	comment_pending: (object) =>
		object ? `在《${object}》下提交了评论，待审核` : "提交了评论，待审核",
	tweet_liked: () => "赞了你的推文",
	tweet_quoted: () => "引用了你的推文",
	tweet_commented: () => "评论了你的推文",
	tweet_comment_replied: () => "回复了你的评论",
	user_registered: () => "注册了账号",
	chat_room_invited: (object) => (object ? `邀请你加入房间「${object}」` : "邀请你加入聊天室"),
};

/** 没有原文的互动，被互动的内容本身就是引用行。 */
const OBJECT_AS_QUOTE: NotificationSourceType[] = ["tweet_liked", "tweet_quoted"];

/** 审核结果没有行为人：用对象标题说清是哪条评论，缺对象标题时取标题原句。 */
const SYSTEM_ACTION: Partial<Record<NotificationSourceType, (object: string) => string>> = {
	comment_approved: (object) => `你在《${object}》下的评论已通过审核`,
	comment_rejected: (object) => `你在《${object}》下的评论未通过审核`,
};

/** 通知读模型 → 面板里一行的展示数据；缺结构化字段的旧通知退回标题与正文。 */
export function toNoticeEntry(item: NotificationItem): NoticeEntry {
	const createdAt = new Date(item.created_at);
	const base = {
		id: item.id,
		icon: SOURCE_ICON[item.source_type] ?? Bell,
		time: formatMessageTime(createdAt),
		unread: !item.is_read,
		group: isSameDay(createdAt, new Date()) ? ("today" as const) : ("earlier" as const),
	};
	const describe = ACTION[item.source_type];
	if (item.actor && describe) {
		return {
			...base,
			actor: { name: item.actor.name, avatar: item.actor.avatar_url },
			text: describe(item.object_title),
			quote:
				item.quote ??
				(OBJECT_AS_QUOTE.includes(item.source_type) ? item.object_title : undefined),
		};
	}
	return {
		...base,
		text:
			(item.object_title && SYSTEM_ACTION[item.source_type]?.(item.object_title)) ??
			item.title,
		quote: item.quote ?? (item.body || undefined),
	};
}
