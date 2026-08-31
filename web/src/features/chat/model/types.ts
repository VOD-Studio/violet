import type { CommentEmoteRef } from "@entities/comment/model/types";

export type ConversationKind = "direct" | "room";
export type MessageType = "text" | "image" | "system" | "tweet_share";
export type MemberRole = "owner" | "member";

export interface ChatUser {
	id: string;
	username: string;
	display_name: string;
	avatar_url: string;
}

export interface ChatMember {
	user: ChatUser;
	role: MemberRole;
	joined_at: string;
	is_muted: boolean;
}

export interface ChatMedia {
	id: string;
	url: string;
	thumbnail?: string;
	mime_type: string;
	size: number;
	width?: number;
	height?: number;
}

/** 分享到聊天的推文快照；`is_deleted` 时其余字段均为空（被分享推文已物理删除）。 */
export interface SharedTweet {
	id: string;
	author?: ChatUser;
	content?: string;
	images?: string[];
	created_at?: string;
	is_deleted: boolean;
}

export interface ChatMessageReference {
	id: string;
	sender: ChatUser;
	type: Exclude<MessageType, "system">;
	content?: string;
	media?: ChatMedia;
	is_deleted: boolean;
}

export interface ChatMessageReaction {
	emoji_id: number;
	emoji_name: string;
	emoji_url: string;
	gif_url: string;
	count: number;
	self: boolean;
}

export interface ChatMessage {
	id: string;
	conversation_id: string;
	sender: ChatUser;
	type: MessageType;
	content?: string;
	/** 正文中 [name:uuid] 自定义表情占位符的解析结果，key 为完整占位符（含方括号） */
	custom_emote?: Record<string, CommentEmoteRef>;
	/** 图片消息的媒体列表，按输入流中的占位符顺序；非图片消息缺省 */
	media?: ChatMedia[];
	shared_tweet?: SharedTweet;
	reply_to?: ChatMessageReference;
	reactions: ChatMessageReaction[];
	/** 已读回执；仅自己发送的非系统消息附带（见 CONTEXT.md「已读回执」词条） */
	read_state?: ChatMessageReadState;
	is_deleted: boolean;
	deleted_at?: string;
	/** 最后编辑时间；缺省表示从未编辑 */
	edited_at?: string;
	created_at: string;
}
/** 消息已读回执。 */
export interface ChatMessageReadState {
	/** 已读到该消息的其他有效成员数 */
	read_count: number;
	/** 会话中除自己外的当前有效成员数 */
	member_count: number;
}

/** 消息已读成员名单项。 */
export interface ChatMessageReader {
	user: ChatUser;
	/** 该成员最近一次标记阅读的时间 */
	read_at: string;
}

export interface ChatConversation {
	id: string;
	kind: ConversationKind;
	title: string;
	owner: ChatUser;
	members?: ChatMember[];
	last_message?: ChatMessage;
	unread_count: number;
	created_at: string;
	updated_at: string;
}

export interface CreateConversationInput {
	kind: ConversationKind;
	title?: string;
	participant_ids: string[];
}

export interface SendMessageInput {
	type: Exclude<MessageType, "system">;
	content?: string;
	media_ids?: string[];
	shared_tweet_id?: string;
	reply_to_id?: string;
}

export interface EditChatMessageInput {
	content: string;
	/** 图片消息修订后的媒体 ID 列表（整体替换，至少一张）；非图片消息省略 */
	media_ids?: string[];
}

export interface ChatEvent {
	id: string;
	type:
		| "message.created"
		| "room.invited"
		| "conversation.created"
		| "member.changed"
		| "message.deleted"
		| "message.reaction.updated"
		| "read.advanced"
		| "typing.updated";
	version: number;
	occurred_at: string;
	data: Record<string, unknown>;
	/** 新消息正文中自定义表情的解析结果；关系按当前事件接收者计算。 */
	custom_emote?: Record<string, CommentEmoteRef>;
}

/** typing.updated 事件的 data 载荷；不持久化，仅供实时推送消费。 */
export interface ChatTypingEventData {
	conversation_id: string;
	user_id: string;
	is_typing: boolean;
}

export interface PushConfig {
	public_key: string;
	enabled: boolean;
}

export interface PushSubscriptionInput {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	show_preview: boolean;
}

export interface ChatUnreadCount {
	unread_count: number;
}
