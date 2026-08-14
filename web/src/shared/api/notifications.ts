import { apiGet, apiGetPaged, apiPost } from "./request";

/** 通知来源类型（与后端 source_type 受控枚举同步） */
export type NotificationSourceType =
	| "subscription_failed"
	| "subscription_succeeded"
	| "friendlink_applied"
	| "friendlink_reviewed"
	| "comment_approved"
	| "comment_created"
	| "comment_pending"
	| "comment_rejected"
	| "user_registered"
	| "account_security";

/** 通知读模型（后端 NotificationDTO 对应） */
export interface NotificationItem {
	id: string;
	source_type: NotificationSourceType;
	source_id: string;
	title: string;
	body: string;
	payload: Record<string, unknown>;
	is_read: boolean;
	read_at?: string;
	created_at: string;
}

/** SSE 推送的事件结构（后端 SSEEvent 对应） */
export interface NotificationSSEEvent {
	id: string;
	source_type: NotificationSourceType;
	source_id: string;
	title: string;
	body: string;
	payload: Record<string, unknown>;
	created_at: string;
}

export interface UnreadCountResponse {
	unread_count: number;
}
/** 通知列表查询 */
export const fetchNotifications = (page = 1, limit = 20) =>
	apiGetPaged<NotificationItem>("/notifications", {
		params: { page, limit },
	});

/** 未读计数查询（SSE 断连时 fallback 轮询） */
export const fetchUnreadCount = () => apiGet<UnreadCountResponse>("/notifications/unread-count");

/** 标记单条已读 */
export const markNotificationRead = (id: string) => apiPost<null>(`/notifications/${id}/read`);

/** 标记全部已读 */
export const markAllNotificationsRead = () => apiPost<null>("/notifications/read-all");
