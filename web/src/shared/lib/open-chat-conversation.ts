/**
 * 跳转到聊天工作区并打开指定会话。
 *
 * 聊天页以 `?c=` 管理选中会话并监听 popstate（useChatSelection）；
 * 直接改 URL 再派发 popstate：已在 /chat 时切换选中，其他页面触发路由匹配挂载。
 */
export function openChatConversation(conversationID: string) {
	window.history.pushState({}, "", `/chat?c=${encodeURIComponent(conversationID)}`);
	window.dispatchEvent(new PopStateEvent("popstate"));
}
