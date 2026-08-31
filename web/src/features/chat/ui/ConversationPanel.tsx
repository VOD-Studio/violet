/**
 * 会话面板：消息流（滚动加载历史）、气泡、输入区与详情抽屉的编排。
 */
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import type { PendingChatShare } from "@shared/api/share-tweet-store";
import { Button } from "@shared/ui/base/button";
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { ArrowDown, ArrowLeft, LoaderCircle, MoreVertical } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	useChatMembers,
	useChatMessages,
	useDeleteChatMessage,
	useMarkChatRead,
} from "../api/queries";
import { useEmojiEmoteMap } from "../hooks/use-emoji-emote-map";
import { conversationLabel, conversationTargetUser, formatDate } from "../lib/conversation";
import type { ChatConversation, ChatMessage } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { MessageEmpty, MessageSkeleton } from "./chat-states";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { RoomDetails } from "./RoomDetails";
import { TypingIndicator } from "./TypingIndicator";

export interface ConversationPanelProps {
	/** 当前会话。 */
	conversation: ChatConversation;
	/** 当前用户 ID。 */
	currentUserID: string;
	/** 返回会话列表。 */
	onBack: () => void;
	/** 落定到当前会话的待发分享；非本会话或无分享时为 null。 */
	pendingShare: PendingChatShare | null;
	/** 是否显示成员详情。 */
	showDetails: boolean;
	/** 切换成员详情抽屉。 */
	onToggleDetails: () => void;
}

export function ConversationPanel({
	conversation,
	currentUserID,
	onBack,
	pendingShare,
	showDetails,
	onToggleDetails,
}: ConversationPanelProps) {
	const {
		data: messagePages,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: messagesLoading,
	} = useChatMessages(conversation.id);
	const { data: memberData } = useChatMembers(conversation.id);
	const members = memberData ?? [];
	const canManage = useHasPermission("chat:manage");
	const deleteMessage = useDeleteChatMessage();
	const read = useMarkChatRead();
	const imagePreview = useImagePreview();
	const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
	const [pendingFocusID, setPendingFocusID] = useState<string | null>(null);
	const [highlightedID, setHighlightedID] = useState<string | null>(null);

	const messages = useMemo(
		() => messagePages?.pages.flatMap((page) => page.data).reverse() ?? [],
		[messagePages?.pages],
	);
	const lastMessage = messages.at(-1);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef<Record<string, HTMLElement | null>>({});
	const [showScrollBottom, setShowScrollBottom] = useState(false);
	const topSentinelRef = useRef<HTMLDivElement>(null);
	const prependScrollAnchorRef = useRef<number | null>(null);
	const latestKnownMessageTimeRef = useRef<number | null>(null);
	const earliestKnownMessageTimeRef = useRef<number | null>(null);

	const scrollToBottom = useCallback((smooth = true) => {
		const container = scrollContainerRef.current;
		if (!container) return;
		container.scrollTo({
			top: Math.max(0, container.scrollHeight - container.clientHeight),
			behavior: smooth ? "smooth" : "auto",
		});
	}, []);

	useEffect(() => {
		if (lastMessage?.id && conversation.unread_count > 0) {
			read.mutate({ id: conversation.id, messageId: lastMessage.id });
		}
	}, [conversation.id, conversation.unread_count, lastMessage?.id, read.mutate]);

	useEffect(() => {
		if (lastMessage?.id) scrollToBottom(false);
	}, [lastMessage?.id, scrollToBottom]);

	useEffect(() => {
		if (!conversation.id) return;
		setReplyTarget(null);
		setPendingFocusID(null);
		setHighlightedID(null);
		prependScrollAnchorRef.current = null;
		latestKnownMessageTimeRef.current = null;
		earliestKnownMessageTimeRef.current = null;
		return () => {
			messageRefs.current = {};
		};
	}, [conversation.id]);

	useEffect(() => {
		if (!pendingFocusID) return;
		const target = messageRefs.current[pendingFocusID];
		if (target) {
			const container = scrollContainerRef.current;
			if (container) {
				const offset =
					target.getBoundingClientRect().top - container.getBoundingClientRect().top;
				container.scrollTo({ top: container.scrollTop + offset - 24, behavior: "smooth" });
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
		if (!highlightedID) return;
		const timer = window.setTimeout(() => setHighlightedID(null), 1400);
		return () => window.clearTimeout(timer);
	}, [highlightedID]);

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const { scrollTop, scrollHeight, clientHeight } = container;
		setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);
	}, []);

	useEffect(() => {
		const container = scrollContainerRef.current;
		const sentinel = topSentinelRef.current;
		if (!container || !sentinel || !hasNextPage) return;
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
		if (!container || previousHeight === null) return;
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
		if (newest) latestKnownMessageTimeRef.current = new Date(newest).getTime();
	}, [messages]);

	// 往回翻页刚落地的这一次渲染：临时关闭 layout 位移动画。否则已有消息会被
	// Framer Motion 的 FLIP 动画捕获成"被顶下去又滑回来"，和上面的滚动锚点回补打架，
	// 表现为向上翻页加载历史后出现一个不该有的"滚回去"动画。
	const justBackfilled =
		earliestKnownMessageTimeRef.current !== null &&
		messages.length > 0 &&
		new Date(messages[0].created_at).getTime() < earliestKnownMessageTimeRef.current;

	useEffect(() => {
		const earliest = messages[0]?.created_at;
		if (earliest) earliestKnownMessageTimeRef.current = new Date(earliest).getTime();
	}, [messages]);

	const emoteMap = useEmojiEmoteMap();

	return (
		<motion.div
			key={conversation.id}
			initial={{ opacity: 0, y: 6, scale: 0.995 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -6, scale: 0.995 }}
			transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
			className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
		>
			<header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 md:px-5">
				<div className="flex min-w-0 items-center gap-2.5">
					<Button
						aria-label="返回会话列表"
						className="size-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
						onClick={onBack}
						size="icon"
						variant="ghost"
					>
						<ArrowLeft className="size-5" />
					</Button>
					<div className="shrink-0">
						<ChatAvatar
							user={conversationTargetUser(conversation, currentUserID)}
							className="size-10 shrink-0"
						/>
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-[0.95rem] font-semibold text-foreground">
							{conversationLabel(conversation, currentUserID)}
						</h2>
						<p className="text-xs leading-4 text-muted-foreground">
							{conversation.kind === "room"
								? `${members.length} 位成员`
								: "最后登录于最近"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1">
					<Button
						aria-label="打开会话详情"
						className="size-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
						onClick={onToggleDetails}
						size="icon"
						variant="ghost"
					>
						<MoreVertical className="size-5" />
					</Button>
				</div>
			</header>

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<section className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div
						ref={scrollContainerRef}
						data-testid="chat-message-list"
						onScroll={handleScroll}
						className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 md:px-8"
					>
						<div className="mx-auto max-w-4xl space-y-4">
							{messages.length > 0 &&
								(hasNextPage ? (
									<div
										ref={topSentinelRef}
										data-testid="chat-load-older-sentinel"
										className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
									>
										{isFetchingNextPage && (
											<>
												<LoaderCircle className="size-3.5 animate-spin" />
												加载更早的消息…
											</>
										)}
									</div>
								) : (
									<div
										className="my-4 flex items-center justify-center"
										data-testid="chat-history-start"
									>
										<span className="rounded-full bg-secondary px-3 py-0.5 text-[11px] text-muted-foreground">
											{formatDate(conversation.created_at)}
										</span>
									</div>
								))}

							{messagesLoading ? (
								<MessageSkeleton />
							) : messages.length === 0 ? (
								<MessageEmpty />
							) : (
								messages.map((message, index) => (
									<MessageBubble
										layout={justBackfilled ? false : "position"}
										animateIn={animateInIds.has(message.id)}
										conversationKind={conversation.kind}
										currentUserID={currentUserID}
										emoteMap={emoteMap}
										highlighted={highlightedID === message.id}
										key={message.id}
										message={message}
										messageRef={(node) => {
											messageRefs.current[message.id] = node;
										}}
										showSender={
											conversation.kind !== "room" ||
											index === 0 ||
											messages[index - 1]?.sender.id !== message.sender.id
										}
										showSenderName={conversation.kind === "room"}
										onDelete={
											canManage
												? () =>
														deleteMessage.mutate({
															conversationID: conversation.id,
															messageID: message.id,
														})
												: undefined
										}
										onImage={(media) => imagePreview.openPreview([media.url])}
										onReply={
											message.type !== "system" && !message.is_deleted
												? () => setReplyTarget(message)
												: undefined
										}
										onReplyTo={
											message.reply_to && !message.reply_to.is_deleted
												? () =>
														setPendingFocusID(
															message.reply_to?.id ?? null,
														)
												: undefined
										}
									/>
								))
							)}
							<div className="h-0" />
						</div>
					</div>
					<AnimatePresence>
						{showScrollBottom && (
							<motion.div
								initial={{ opacity: 0, y: 12, scale: 0.8 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, y: 12, scale: 0.8 }}
								transition={{ duration: 0.15 }}
								className="pointer-events-none absolute bottom-24 right-6 z-10 md:right-10"
							>
								<Button
									aria-label="回到底部"
									className="pointer-events-auto size-8.5 rounded-full border border-border bg-card shadow-md"
									onClick={() => scrollToBottom(true)}
									size="icon-sm"
									variant="outline"
								>
									<ArrowDown className="size-4" />
								</Button>
							</motion.div>
						)}
					</AnimatePresence>
					<TypingIndicator conversationID={conversation.id} members={members} />
					<MessageComposer
						conversationID={conversation.id}
						onCancelReply={() => setReplyTarget(null)}
						onMessageSent={() => {
							setReplyTarget(null);
							scrollToBottom(true);
						}}
						pendingShare={pendingShare}
						replyTarget={replyTarget}
					/>
				</section>

				<AnimatePresence>
					{showDetails && (
						<RoomDetails
							conversation={conversation}
							currentUserID={currentUserID}
							members={members}
							onClose={onToggleDetails}
						/>
					)}
				</AnimatePresence>
			</div>
			<ImagePreview
				open={imagePreview.open}
				images={imagePreview.images}
				currentIndex={imagePreview.currentIndex}
				onClose={imagePreview.closePreview}
				onIndexChange={imagePreview.setCurrentIndex}
			/>
		</motion.div>
	);
}
