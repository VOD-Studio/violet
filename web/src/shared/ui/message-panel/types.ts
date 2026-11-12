import type { LucideIcon } from "lucide-react";

/** 消息面板的两个标签。 */
export type MessageTab = "notice" | "chat";

/** 一条通知的展示数据；由接线层从通知读模型整理而来，展示层不认识通知类型。 */
export interface NoticeEntry {
	id: string;
	/** 类型图标：有行为人时挂在头像右下角，没有时是头像位上的图标底。 */
	icon: LucideIcon;
	/** 行为人；系统通知没有。 */
	actor?: { name: string; avatar?: string };
	/** 做了什么，不含行为人名字。 */
	text: string;
	/** 一行原文，展示时包一层「」。 */
	quote?: string;
	/** 已格式化的相对时间。 */
	time: string;
	unread: boolean;
	group: "today" | "earlier";
}

/** 聊天标签里的一个会话。 */
export interface ChatEntry {
	id: string;
	name: string;
	avatar?: string;
	/** 最新一条的摘要。 */
	preview: string;
	/** 已格式化的最新一条时间。 */
	time: string;
	/** 未读条数；0 表示已读。 */
	unread: number;
}

/** 新聊天消息轻提示的展示数据。 */
export interface ChatAlertEntry {
	conversationId: string;
	name: string;
	avatar?: string;
	/** 「回复了你」「发来一条消息」这类动作，不含名字。 */
	action: string;
	preview: string;
}
