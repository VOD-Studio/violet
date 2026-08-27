import { useCallback, useEffect, useState } from "react";

/** 将当前会话同步到 URL，并响应浏览器历史导航。 */
export function useChatSelection() {
	const [selectedID, setSelectedID] = useState<string | null>(() => readChatSelection());

	useEffect(() => {
		const handlePopState = () => setSelectedID(readChatSelection());
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const selectConversation = useCallback((id: string) => {
		const url = new URL(window.location.href);
		if (url.searchParams.get("c") === id) return;
		url.searchParams.set("c", id);
		window.history.pushState({}, "", url);
		setSelectedID(id);
	}, []);

	const clearSelection = useCallback((replace = false) => {
		const url = new URL(window.location.href);
		if (!url.searchParams.has("c")) {
			setSelectedID(null);
			return;
		}
		url.searchParams.delete("c");
		const updateHistory = replace ? window.history.replaceState : window.history.pushState;
		updateHistory.call(window.history, {}, "", url);
		setSelectedID(null);
	}, []);

	return { selectedID, selectConversation, clearSelection };
}

function readChatSelection() {
	if (typeof window === "undefined") return null;
	return new URL(window.location.href).searchParams.get("c");
}
