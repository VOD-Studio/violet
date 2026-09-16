import { type RefObject, useEffect } from "react";

/** 仅当阅读者本就在底部时跟随高度变化;翻阅历史时不跟随。 */
export function useAppearanceScrollFollow(
	scrollRef: RefObject<HTMLDivElement | null>,
	followLatestRef: RefObject<boolean>,
	prependAnchorRef: RefObject<number | null>,
	conversationID: string,
) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: conversationID 仅作触发器,切换会话时重新挂载观察器
	useEffect(() => {
		const viewport = scrollRef.current;
		const content = viewport?.firstElementChild;
		if (!viewport || !content || typeof ResizeObserver === "undefined") return;
		let frame = 0;
		const observer = new ResizeObserver(() => {
			if (!followLatestRef.current || prependAnchorRef.current !== null) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (followLatestRef.current && prependAnchorRef.current === null) {
					viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
				}
			});
		});
		observer.observe(content);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [scrollRef, followLatestRef, prependAnchorRef, conversationID]);
}
