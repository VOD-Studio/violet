import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { useMarkChatRead } from "../api/queries";
import type { ChatMessage } from "../model/types";

interface ChatReadWatermarkOptions {
	conversationID: string;
	messages: ChatMessage[];
	active: boolean;
	showDetails: boolean;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messageRefs: RefObject<Record<string, HTMLElement | null>>;
}

/** 只提交当前前台视口里完整可见消息的已读位置。 */
export function useChatReadWatermark({
	conversationID,
	messages,
	active,
	showDetails,
	scrollContainerRef,
	messageRefs,
}: ChatReadWatermarkOptions) {
	const read = useMarkChatRead();
	const lastSubmittedReadRef = useRef<string | null>(null);
	useLayoutEffect(() => {
		if (conversationID) {
			lastSubmittedReadRef.current = null;
		}
	}, [conversationID]);
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || !active || showDetails) {
			return;
		}
		let frame = 0;
		const markVisibleRead = () => {
			if (document.visibilityState !== "visible" || !document.hasFocus()) {
				return;
			}
			const viewport = container.getBoundingClientRect();
			if (viewport.height <= 0) {
				return;
			}
			const previousIndex = messages.findIndex(
				(message) => message.id === lastSubmittedReadRef.current,
			);
			for (let index = messages.length - 1; index > previousIndex; index--) {
				const message = messages[index];
				if (message.id.startsWith("local:")) {
					continue;
				}
				const bounds = messageRefs.current[message.id]?.getBoundingClientRect();
				if (
					!bounds ||
					bounds.height <= 0 ||
					bounds.bottom > viewport.bottom ||
					bounds.bottom <= viewport.top
				) {
					continue;
				}
				lastSubmittedReadRef.current = message.id;
				read.mutate(
					{ id: conversationID, messageId: message.id },
					{
						onError: () => {
							if (lastSubmittedReadRef.current === message.id) {
								lastSubmittedReadRef.current = null;
							}
						},
					},
				);
				break;
			}
		};
		const scheduleRead = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(markVisibleRead);
		};
		container.addEventListener("scroll", scheduleRead);
		window.addEventListener("focus", scheduleRead);
		window.addEventListener("resize", scheduleRead);
		document.addEventListener("visibilitychange", scheduleRead);
		const observer = new ResizeObserver(scheduleRead);
		observer.observe(container);
		if (container.firstElementChild) {
			observer.observe(container.firstElementChild);
		}
		scheduleRead();
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			container.removeEventListener("scroll", scheduleRead);
			window.removeEventListener("focus", scheduleRead);
			window.removeEventListener("resize", scheduleRead);
			document.removeEventListener("visibilitychange", scheduleRead);
		};
	}, [
		active,
		showDetails,
		conversationID,
		messages,
		read.mutate,
		scrollContainerRef,
		messageRefs,
	]);
}
