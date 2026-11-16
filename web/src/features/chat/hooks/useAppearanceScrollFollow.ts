import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import type { ChatMessage } from "../model/types";

interface AppearanceScrollFollowOptions {
	scrollRef: RefObject<HTMLDivElement | null>;
	followLatestRef: RefObject<boolean>;
	prependAnchorRef: RefObject<number | null>;
	messageRefs: RefObject<Record<string, HTMLElement | null>>;
	messages: ChatMessage[];
	conversationID: string;
}

interface MessageScrollAnchor {
	messageID: string;
	edge: "top" | "bottom";
	offset: number;
}

/**
 * 贴底时跟随末条，翻阅历史时保持下方消息的位置。
 *
 * @remarks 顶部翻页的高度回补由调用方完成，此处不重复补偿。
 */
export function useAppearanceScrollFollow({
	scrollRef,
	followLatestRef,
	prependAnchorRef,
	messageRefs,
	messages,
	conversationID,
}: AppearanceScrollFollowOptions) {
	const messagesRef = useRef(messages);
	const restoreRef = useRef<{ conversationID: string; restore: () => void } | null>(null);
	useLayoutEffect(() => {
		messagesRef.current = messages;
		if (restoreRef.current?.conversationID === conversationID) {
			restoreRef.current.restore();
		}
	}, [messages, conversationID]);

	useEffect(() => {
		const viewport = scrollRef.current;
		const content = viewport?.firstElementChild;
		if (!viewport || !content || typeof ResizeObserver === "undefined") return;
		let previousHeight = viewport.scrollHeight;
		let previousClientHeight = viewport.clientHeight;
		let previousTop = viewport.scrollTop;
		const captureAnchor = (): MessageScrollAnchor | null => {
			const currentMessages = messagesRef.current;
			const bounds = viewport.getBoundingClientRect();
			let start = 0;
			let end = currentMessages.length;
			while (start < end) {
				const middle = Math.floor((start + end) / 2);
				const element = messageRefs.current[currentMessages[middle].id];
				if (!element) return null;
				if (element.getBoundingClientRect().top < bounds.bottom) {
					start = middle + 1;
				} else {
					end = middle;
				}
			}
			const message = currentMessages[Math.min(start, currentMessages.length - 1)];
			const element = message && messageRefs.current[message.id];
			if (!element) return null;
			const edge = start < currentMessages.length ? "top" : "bottom";
			return {
				messageID: message.id,
				edge,
				offset: element.getBoundingClientRect()[edge] - bounds.top,
			};
		};
		let anchor = captureAnchor();
		const rememberPosition = () => {
			previousHeight = viewport.scrollHeight;
			previousClientHeight = viewport.clientHeight;
			previousTop = viewport.scrollTop;
			anchor = prependAnchorRef.current === null ? captureAnchor() : null;
		};
		const handleScroll = () => {
			if (
				prependAnchorRef.current !== null ||
				viewport.scrollTop !== previousTop ||
				(viewport.scrollHeight === previousHeight &&
					viewport.clientHeight === previousClientHeight)
			) {
				rememberPosition();
			}
		};
		const restore = () => {
			if (prependAnchorRef.current !== null) {
				rememberPosition();
				return;
			}
			if (followLatestRef.current) {
				const previousGap = Math.max(
					0,
					previousHeight - previousTop - previousClientHeight,
				);
				// 贴底容差内保留原有余量，避免内容更新时再吸附 1–2px。
				const gap = previousGap <= 2 ? previousGap : 0;
				viewport.scrollTop = Math.max(
					0,
					viewport.scrollHeight - viewport.clientHeight - gap,
				);
			} else if (anchor && viewport.scrollHeight !== previousHeight) {
				const element = messageRefs.current[anchor.messageID];
				if (element) {
					const offset =
						element.getBoundingClientRect()[anchor.edge] -
						viewport.getBoundingClientRect().top;
					viewport.scrollTop += offset - anchor.offset;
				}
			}
			rememberPosition();
		};
		restoreRef.current = { conversationID, restore };
		// React 更新和图片解码都在绘制前补偿，不能再等下一帧出现先下移后回弹。
		const observer = new ResizeObserver(restore);
		viewport.addEventListener("scroll", handleScroll, { passive: true });
		observer.observe(content);
		observer.observe(viewport);
		return () => {
			viewport.removeEventListener("scroll", handleScroll);
			observer.disconnect();
			restoreRef.current = null;
		};
	}, [scrollRef, followLatestRef, prependAnchorRef, messageRefs, conversationID]);
}
