const root = ["chat"] as const;

export const chatKeys = {
	root,
	conversations: () => [...root, "conversations"] as const,
	conversation: (id: string) => [...root, "conversation", id] as const,
	members: (id: string) => [...root, "conversation", id, "members"] as const,
	messages: (id: string) => [...root, "conversation", id, "messages"] as const,
	unreadCount: () => [...root, "unread-count"] as const,
	user: (username: string) => [...root, "user", username] as const,
	pushConfig: () => [...root, "push-config"] as const,
};
