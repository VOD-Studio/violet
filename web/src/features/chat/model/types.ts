export type ConversationKind = "direct" | "room";
export type MessageType = "text" | "image" | "system";
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

export interface ChatMessage {
	id: string;
	conversation_id: string;
	sender: ChatUser;
	type: MessageType;
	content?: string;
	media?: ChatMedia;
	is_deleted: boolean;
	deleted_at?: string;
	created_at: string;
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
	type: MessageType;
	content?: string;
	media_id?: string;
}

export interface ChatEvent {
	id: string;
	type: "message.created" | "room.invited" | "member.changed" | "message.deleted";
	version: number;
	occurred_at: string;
	data: Record<string, unknown>;
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
