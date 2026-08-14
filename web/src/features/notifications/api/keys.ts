/** notifications feature query key 工厂 */

const root = ["notifications"] as const;

export const notificationKeys = {
	all: root,
	list: [...root, "list"] as const,
	unreadCount: [...root, "unread-count"] as const,
};
