import { useEffect } from "react";

/** 在当前页面标题前显示聊天未读数，清零或卸载时恢复原标题。 */
export function useChatUnreadTitle(unreadCount: number) {
	useEffect(() => {
		if (unreadCount <= 0) return;
		const prefix = `(${unreadCount > 99 ? "99+" : unreadCount} 条未读) `;
		let originalTitle = document.title;
		let unreadTitle = prefix + originalTitle;
		document.title = unreadTitle;

		// 路由 head 会替换 title 节点或文本，需在新页面标题上重新加提示。
		const observer = new MutationObserver(() => {
			if (document.title === unreadTitle) return;
			originalTitle = document.title;
			unreadTitle = prefix + originalTitle;
			document.title = unreadTitle;
		});
		observer.observe(document.head, { childList: true, subtree: true, characterData: true });
		return () => {
			observer.disconnect();
			if (document.title === unreadTitle) document.title = originalTitle;
		};
	}, [unreadCount]);
}
