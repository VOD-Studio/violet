import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import type { ChatMessage } from "../model/types";
import { useAppearanceScrollFollow } from "./useAppearanceScrollFollow";
import { useChatReadWatermark } from "./useChatReadWatermark";

interface ConversationScrollOptions {
	conversationID: string;
	currentUserID: string;
	messages: ChatMessage[];
	active: boolean;
	showDetails: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
}

export interface ConversationScrollState {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messageRefs: RefObject<Record<string, HTMLElement | null>>;
	topSentinelRef: RefObject<HTMLDivElement | null>;
	highlightedID: string | null;
	setPendingFocusID: (id: string | null) => void;
	scrollToBottom: (smooth?: boolean) => void;
	showScrollBottom: boolean;
	handleScroll: () => void;
	pauseFollow: () => void;
	animateInIds: Set<string>;
}

/** 保留历史加载锚点，只对可见消息推进水位；外观变化沿用同一滚动容器。 */
export function useConversationScroll({
	conversationID,
	currentUserID,
	messages,
	active,
	showDetails,
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
}: ConversationScrollOptions): ConversationScrollState {
	const [pendingFocusID, setPendingFocusID] = useState<string | null>(null);
	const [highlightedID, setHighlightedID] = useState<string | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef<Record<string, HTMLElement | null>>({});
	const lastMessage = messages.at(-1);
	const [showScrollBottom, setShowScrollBottom] = useState(false);
	const topSentinelRef = useRef<HTMLDivElement>(null);
	const prependScrollAnchorRef = useRef<number | null>(null);
	const latestKnownMessageTimeRef = useRef<number | null>(null);
	const followLatestRef = useRef(true);
	const lastScrollPositionRef = useRef({ top: 0, height: 0 });

	const scrollToBottom = useCallback((smooth = true) => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}
		followLatestRef.current = true;
		container.scrollTo({
			top: Math.max(0, container.scrollHeight - container.clientHeight),
			behavior:
				smooth &&
				!container.closest('[data-motion="reduce"]') &&
				!window.matchMedia("(prefers-reduced-motion: reduce)").matches
					? "smooth"
					: "auto",
		});
	}, []);

	useAppearanceScrollFollow({
		scrollRef: scrollContainerRef,
		followLatestRef,
		prependAnchorRef: prependScrollAnchorRef,
		messageRefs,
		messages,
		conversationID,
	});

	useLayoutEffect(() => {
		if (!conversationID) {
			return;
		}
		followLatestRef.current = true;
		lastScrollPositionRef.current = { top: 0, height: 0 };
		setPendingFocusID(null);
		setHighlightedID(null);
		prependScrollAnchorRef.current = null;
		latestKnownMessageTimeRef.current = null;
	}, [conversationID]);

	useLayoutEffect(() => {
		if (lastMessage?.id && followLatestRef.current) {
			scrollToBottom(false);
		}
	}, [lastMessage, scrollToBottom]);

	useEffect(() => {
		if (lastMessage?.id && lastMessage.sender.id === currentUserID) {
			scrollToBottom(false);
		}
	}, [lastMessage?.id, lastMessage?.sender.id, currentUserID, scrollToBottom]);

	useChatReadWatermark({
		conversationID,
		messages,
		active,
		showDetails,
		scrollContainerRef,
		messageRefs,
	});

	useEffect(() => {
		if (!pendingFocusID) {
			return;
		}
		const target = messageRefs.current[pendingFocusID];
		if (target) {
			const container = scrollContainerRef.current;
			if (container) {
				const offset =
					target.getBoundingClientRect().top - container.getBoundingClientRect().top;
				container.scrollTo({
					top: container.scrollTop + offset - 24,
					behavior:
						container.closest('[data-motion="reduce"]') ||
						window.matchMedia("(prefers-reduced-motion: reduce)").matches
							? "auto"
							: "smooth",
				});
			}
			setHighlightedID(pendingFocusID);
			setPendingFocusID(null);
			return;
		}
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
			return;
		}
		if (!hasNextPage && !isFetchingNextPage) {
			toast.info("原消息不可用");
			setPendingFocusID(null);
		}
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, pendingFocusID]);

	useEffect(() => {
		if (!highlightedID) {
			return;
		}
		const timer = window.setTimeout(() => setHighlightedID(null), 1400);
		return () => window.clearTimeout(timer);
	}, [highlightedID]);

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}
		const { scrollTop, scrollHeight, clientHeight } = container;
		const distance = scrollHeight - scrollTop - clientHeight;
		if (distance <= 2) {
			followLatestRef.current = true;
		} else if (
			scrollHeight === lastScrollPositionRef.current.height &&
			scrollTop < lastScrollPositionRef.current.top - 2
		) {
			followLatestRef.current = false;
		}
		lastScrollPositionRef.current = { top: scrollTop, height: scrollHeight };
		setShowScrollBottom(distance > 150);
	}, []);
	const pauseFollow = () => {
		followLatestRef.current = false;
	};

	useEffect(() => {
		const container = scrollContainerRef.current;
		const sentinel = topSentinelRef.current;
		if (!container || !sentinel || !hasNextPage) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) {
					prependScrollAnchorRef.current = container.scrollHeight;
					void fetchNextPage();
				}
			},
			{ root: container, rootMargin: "200px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// 翻页前记录 scrollHeight，DOM 更新后按差值回补 scrollTop：避免往上翻历史时
	// 因为顶部插入新内容而把可视区往下顶飘。
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages 仅作触发器，函数体只读写 ref
	useLayoutEffect(() => {
		const container = scrollContainerRef.current;
		const previousHeight = prependScrollAnchorRef.current;
		if (!container || previousHeight === null) {
			return;
		}
		container.scrollTop += container.scrollHeight - previousHeight;
		prependScrollAnchorRef.current = null;
	}, [messages]);

	// 只有比上一次已知最新消息更晚的消息才播入场动画：往回翻页拿到的历史批次
	// 直接以最终态出现，避免一次性弹出一整页历史消息的动效噪音。
	const animateInIds = useMemo(() => {
		const boundary = latestKnownMessageTimeRef.current;
		const ids = new Set<string>();
		for (const message of messages) {
			if (boundary === null || new Date(message.created_at).getTime() > boundary) {
				ids.add(message.id);
			}
		}
		return ids;
	}, [messages]);

	useEffect(() => {
		const newest = messages.at(-1)?.created_at;
		if (newest) {
			latestKnownMessageTimeRef.current = new Date(newest).getTime();
		}
	}, [messages]);

	return {
		scrollContainerRef,
		messageRefs,
		topSentinelRef,
		highlightedID,
		setPendingFocusID,
		scrollToBottom,
		showScrollBottom,
		handleScroll,
		pauseFollow,
		animateInIds,
	};
}
