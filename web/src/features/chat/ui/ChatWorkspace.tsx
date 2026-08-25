import type { Emoji } from "@entities/emoji/model/types";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { stripImagePlaceholders } from "@features/comments/hooks/use-rich-text-input";
import { type PictureInput, RichCommentInput } from "@features/comments/ui/RichCommentInput";
import { useAllEmojis } from "@features/emojis/api/queries";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { type PendingChatShare, useShareTweetStore } from "@shared/api/share-tweet-store";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import {
	AlertTriangle,
	ArrowDown,
	ArrowLeft,
	Bell,
	BellOff,
	Check,
	Copy,
	Image as ImageIcon,
	LoaderCircle,
	LogOut,
	MessageCircle,
	MessageSquareQuote,
	MoreVertical,
	Plus,
	Reply,
	Search,
	Send,
	ShieldCheck,
	Smile,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { fetchChatUser } from "../api/client";
import {
	useAddChatMessageReaction,
	useChatContacts,
	useChatConversations,
	useChatMembers,
	useChatMessages,
	useCreateChatConversation,
	useDeleteChatMessage,
	useInviteChatMember,
	useLeaveChatConversation,
	useMarkChatRead,
	useRemoveChatMember,
	useRemoveChatMessageReaction,
	useRenameChatConversation,
	useSendChatMessage,
	useSetChatMuted,
} from "../api/queries";
import { useChatPushNotifications } from "../hooks/useChatPushNotifications";
import { useChatSelection } from "../hooks/useChatSelection";
import { useChatTypingBroadcaster } from "../hooks/useChatTyping";
import type {
	ChatConversation,
	ChatMedia,
	ChatMember,
	ChatMessage,
	ChatMessageReference,
	ChatUser,
} from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";
import { ChatMessageContent } from "./ChatMessageContent";
import { ChatReactionBar } from "./ChatReactionBar";
import { NewConversationForm } from "./NewConversationForm";
import { TweetShareCard } from "./TweetShareCard";
import { TypingIndicator } from "./TypingIndicator";

/** 聊天工作区：会话索引、消息流、房间成员抽屉与富文本 composer。 */
export function ChatWorkspace() {
	const { data: me } = useMe();
	const { data: conversationsPage, isLoading: conversationsLoading } = useChatConversations();
	const conversations = conversationsPage?.data ?? [];
	const { selectedID, selectConversation, clearSelection } = useChatSelection();
	const pendingShare = useShareTweetStore((s) => s.pending);
	const [search, setSearch] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [showNew, setShowNew] = useState(false);

	const selected = conversations.find((conversation) => conversation.id === selectedID) ?? null;
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return conversations;
		return conversations.filter((conversation) =>
			conversationLabel(conversation, me?.id).toLowerCase().includes(query),
		);
	}, [conversations, me?.id, search]);

	useEffect(() => {
		if (selectedID && !selected && !conversationsLoading) clearSelection(true);
	}, [clearSelection, conversationsLoading, selected, selectedID]);

	// 从 ShareTweetDialog 落定的待发分享：自动切到目标会话，输入框读同一 store 的 pending 展示 banner。
	useEffect(() => {
		if (pendingShare) selectConversation(pendingShare.conversationId);
	}, [pendingShare, selectConversation]);

	return (
		<div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
			<aside
				className={cn(
					"relative flex w-full shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-xl md:flex md:w-80 lg:w-84",
					selectedID && "hidden md:flex",
				)}
			>
				<ConversationIndex
					conversations={filtered}
					currentUserID={me?.id ?? ""}
					loading={conversationsLoading}
					selectedID={selectedID}
					search={search}
					showNew={showNew}
					onSearch={setSearch}
					onToggleNew={() => setShowNew((value) => !value)}
					onSelect={selectConversation}
					onCreated={(id) => {
						selectConversation(id);
						setShowNew(false);
					}}
				/>
			</aside>

			<main
				className={cn(
					"relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/60",
					!selectedID && "hidden md:flex",
				)}
			>
				{selected ? (
					<ConversationPanel
						conversation={selected}
						currentUserID={me?.id ?? ""}
						onBack={clearSelection}
						pendingShare={
							pendingShare?.conversationId === selected.id ? pendingShare : null
						}
						showDetails={showDetails}
						onToggleDetails={() => setShowDetails((value) => !value)}
					/>
				) : (
					<EmptyConversation onCreate={() => setShowNew(true)} />
				)}
			</main>
		</div>
	);
}

interface ConversationIndexProps {
	conversations: ChatConversation[];
	currentUserID: string;
	loading: boolean;
	selectedID: string | null;
	search: string;
	showNew: boolean;
	onSearch: (value: string) => void;
	onToggleNew: () => void;
	onSelect: (id: string) => void;
	onCreated: (id: string) => void;
}

function ConversationIndex({
	conversations,
	currentUserID,
	loading,
	selectedID,
	search,
	showNew,
	onSearch,
	onToggleNew,
	onSelect,
	onCreated,
}: ConversationIndexProps) {
	const deferredSearch = useDeferredValue(search.trim());
	const contactsQuery = useChatContacts(deferredSearch, Boolean(deferredSearch));
	const contacts = contactsQuery.data?.pages.flatMap((page) => page.data) ?? [];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 px-3 pb-2 pt-4 md:px-4">
				<div className="flex h-11 items-center justify-between gap-3 px-1">
					<h1 className="text-[1.35rem] font-semibold text-foreground">聊天</h1>
					<Button
						aria-label="新建会话"
						className={cn(
							"size-9 rounded-full text-muted-foreground transition-colors",
							showNew
								? "bg-secondary text-foreground"
								: "hover:bg-secondary hover:text-foreground",
						)}
						onClick={onToggleNew}
						size="icon"
						variant="ghost"
					>
						<Plus
							className={cn("size-5 transition-transform", showNew && "rotate-45")}
						/>
					</Button>
				</div>
				<div className="px-1 pb-1">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							aria-label="搜索会话、用户或群聊"
							className="h-10 w-full rounded-full border-none bg-secondary pl-10 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
							onChange={(event) => onSearch(event.target.value)}
							placeholder="搜索"
							value={search}
						/>
						{search && (
							<button
								aria-label="清空搜索"
								className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
								onClick={() => onSearch("")}
								type="button"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				</div>
			</header>

			<AnimatePresence>
				{showNew && <NewConversationForm onCreated={onCreated} onClose={onToggleNew} />}
			</AnimatePresence>

			<div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
				{search.trim() ? (
					<SearchResults
						contacts={contacts}
						contactsLoading={contactsQuery.isLoading}
						conversations={conversations}
						currentUserID={currentUserID}
						onCreated={onCreated}
						onSelect={onSelect}
						selectedID={selectedID}
					/>
				) : (
					<>
						<div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
							<span>会话</span>
							<span className="tabular-nums">{conversations.length}</span>
						</div>
						{loading ? (
							<ConversationSkeleton />
						) : conversations.length === 0 ? (
							<ConversationEmpty onCreate={onToggleNew} />
						) : (
							<div className="space-y-1">
								{conversations.map((conversation) => (
									<ConversationRow
										active={conversation.id === selectedID}
										conversation={conversation}
										currentUserID={currentUserID}
										key={conversation.id}
										onClick={() => onSelect(conversation.id)}
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

interface SearchResultsProps {
	conversations: ChatConversation[];
	contacts: ChatUser[];
	contactsLoading: boolean;
	currentUserID: string;
	selectedID: string | null;
	onCreated: (id: string) => void;
	onSelect: (id: string) => void;
}

function SearchResults({
	conversations,
	contacts,
	contactsLoading,
	currentUserID,
	selectedID,
	onCreated,
	onSelect,
}: SearchResultsProps) {
	const create = useCreateChatConversation();
	const [busyID, setBusyID] = useState<string | null>(null);

	const startPrivateChat = async (user: ChatUser) => {
		setBusyID(user.id);
		try {
			const conversation = await create.mutateAsync({
				kind: "direct",
				participant_ids: [user.id],
			});
			onCreated(conversation.id);
		} catch {
			toast.error("无法发起私聊", { description: "请稍后重试" });
		} finally {
			setBusyID(null);
		}
	};

	return (
		<div className="space-y-4">
			<SearchResultSection label="已有会话" count={conversations.length}>
				{conversations.length > 0 ? (
					<div className="space-y-1">
						{conversations.map((conversation) => (
							<ConversationRow
								active={conversation.id === selectedID}
								conversation={conversation}
								currentUserID={currentUserID}
								key={conversation.id}
								onClick={() => onSelect(conversation.id)}
							/>
						))}
					</div>
				) : (
					<p className="px-2.5 py-2 text-xs text-muted-foreground/70">没有匹配的会话</p>
				)}
			</SearchResultSection>
			<SearchResultSection label="用户" count={contacts.length}>
				{contactsLoading ? (
					<ChatContactSkeleton />
				) : contacts.length > 0 ? (
					<div className="space-y-1">
						{contacts.map((user) => (
							<div
								className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-edge-hairline hover:bg-secondary/40"
								key={user.id}
							>
								<ChatAvatar user={user} className="size-9 shrink-0" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-semibold text-foreground">
										{user.display_name}
									</p>
									<p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
										@{user.username}
									</p>
								</div>
								<Button
									aria-label={`发起与${user.display_name}的私聊`}
									disabled={busyID !== null}
									onClick={() => void startPrivateChat(user)}
									size="sm"
									className="h-8 shrink-0 px-2.5 text-xs shadow-xs"
								>
									{busyID === user.id ? (
										<LoaderCircle className="size-3.5 animate-spin" />
									) : (
										<MessageCircle className="size-3.5" />
									)}
									<span className="sr-only sm:not-sr-only sm:ml-1">私聊</span>
								</Button>
							</div>
						))}
					</div>
				) : (
					<p className="px-2.5 py-2 text-xs text-muted-foreground/70">没有匹配的用户</p>
				)}
			</SearchResultSection>
		</div>
	);
}

function SearchResultSection({
	label,
	count,
	children,
}: {
	label: string;
	count: number;
	children: ReactNode;
}) {
	return (
		<section>
			<div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
				<span>{label}</span>
				<span className="tabular-nums">{count}</span>
			</div>
			{children}
		</section>
	);
}

export interface ConversationRowProps {
	/** 会话资源。 */
	conversation: ChatConversation;
	/** 当前用户 ID，用于私聊标题排除自己。 */
	currentUserID: string;
	/** 是否为当前选中项。 */
	active: boolean;
	/** 选择会话。 */
	onClick: () => void;
}

function ConversationRow({ conversation, currentUserID, active, onClick }: ConversationRowProps) {
	const avatarUser = conversationTargetUser(conversation, currentUserID);
	const lastTime = conversation.last_message?.created_at ?? conversation.updated_at;

	return (
		<button
			className={cn(
				"group relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left outline-none md:px-3",
				active ? "text-foreground" : "text-foreground/90 hover:text-foreground",
			)}
			onClick={onClick}
			type="button"
		>
			{/* 选中态：滑动高亮卡片（layoutId 跨行平滑过渡） */}
			{active && (
				<motion.div
					layoutId="active-chat-row-highlight"
					className="absolute inset-0 rounded-2xl bg-accent"
					transition={{ type: "spring", stiffness: 450, damping: 35 }}
				/>
			)}

			<div className="relative z-10 shrink-0">
				<ChatAvatar user={avatarUser} className="size-12" />
			</div>

			<span className="relative z-10 min-w-0 flex-1 border-b border-border/60 pb-2 group-last:border-0">
				<span className="flex items-center justify-between gap-2 pt-0.5">
					<strong className="truncate text-[0.95rem] font-semibold text-foreground">
						{conversationLabel(conversation, currentUserID)}
					</strong>
					<time className="shrink-0 text-xs leading-5 text-muted-foreground">
						{lastTime ? formatRelativeTime(lastTime) : ""}
					</time>
				</span>
				<span className="mt-0.5 flex items-center justify-between gap-2">
					<span className="truncate text-sm leading-5 text-muted-foreground">
						{conversation.last_message
							? messagePreview(conversation.last_message)
							: "还没有消息，打个招呼吧"}
					</span>
					{conversation.unread_count > 0 && (
						<span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium leading-none text-primary-foreground tabular-nums">
							{conversation.unread_count > 99 ? "99+" : conversation.unread_count}
						</span>
					)}
				</span>
			</span>
		</button>
	);
}

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

function ConversationPanel({
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
	const [lightbox, setLightbox] = useState<ChatMedia | null>(null);
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
						className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8"
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
										onImage={setLightbox}
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
			{lightbox && <ImageLightbox media={lightbox} onClose={() => setLightbox(null)} />}
		</motion.div>
	);
}

interface MessageBubbleProps {
	message: ChatMessage;
	currentUserID: string;
	highlighted: boolean;
	emoteMap: Record<string, { url: string; gif_url?: string; size?: number }>;
	showSender: boolean;
	showSenderName: boolean;
	messageRef: (node: HTMLElement | null) => void;
	onDelete?: () => void;
	onImage: (media: ChatMedia) => void;
	onReply?: () => void;
	onReplyTo?: () => void;
	animateIn: boolean;
	layout: "position" | false;
}

function MessageBubble({
	animateIn,
	layout,
	message,
	currentUserID,
	emoteMap,
	highlighted,
	showSender,
	showSenderName,
	messageRef,
	onDelete,
	onImage,
	onReply,
	onReplyTo,
}: MessageBubbleProps) {
	const mine = message.sender.id === currentUserID;
	const reactions = message.reactions ?? [];
	const selfReactionIds = useMemo(
		() =>
			new Set(
				reactions.filter((reaction) => reaction.self).map((reaction) => reaction.emoji_id),
			),
		[reactions],
	);
	const mergedEmote = useMemo(
		() => (message.custom_emote ? { ...emoteMap, ...message.custom_emote } : emoteMap),
		[emoteMap, message.custom_emote],
	);
	const addReaction = useAddChatMessageReaction(message.conversation_id, message.id);
	const removeReaction = useRemoveChatMessageReaction(message.conversation_id, message.id);
	const reactionBusy = addReaction.isPending || removeReaction.isPending;
	const [copied, setCopied] = useState(false);
	const [touchActionsVisible, setTouchActionsVisible] = useState(false);
	const longPressTimer = useRef<number | null>(null);
	const clearLongPress = () => {
		if (longPressTimer.current === null) return;
		window.clearTimeout(longPressTimer.current);
		longPressTimer.current = null;
	};
	const startLongPress = (event: PointerEvent) => {
		if (event.pointerType !== "touch") return;
		clearLongPress();
		longPressTimer.current = window.setTimeout(() => {
			setTouchActionsVisible(true);
			longPressTimer.current = null;
		}, 500);
	};

	useEffect(() => {
		return () => {
			if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
		};
	}, []);

	const copyText = async () => {
		if (!message.content) return;
		try {
			await navigator.clipboard.writeText(message.content);
			setCopied(true);
			toast.success("已复制到剪贴板");
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("复制失败");
		}
	};

	const handleToggleReaction = (emojiID: number) => {
		if (reactionBusy) return;
		if (selfReactionIds.has(emojiID)) {
			removeReaction.mutate(emojiID);
			return;
		}
		if (selfReactionIds.size >= 3) {
			toast.info("单条消息最多添加 3 种表情");
			return;
		}
		addReaction.mutate(emojiID);
	};

	const handleAddReaction = (emoji: Emoji) => {
		if (reactionBusy || selfReactionIds.has(emoji.id)) return;
		if (selfReactionIds.size >= 3) {
			toast.info("单条消息最多添加 3 种表情");
			return;
		}
		addReaction.mutate(emoji.id);
	};

	if (message.type === "system") {
		return (
			<div className="my-2 flex justify-center">
				<p className="rounded-full bg-secondary px-3.5 py-1.5 text-center text-xs text-muted-foreground">
					{message.content}
				</p>
			</div>
		);
	}

	return (
		<motion.article
			ref={messageRef}
			data-testid={`chat-message-${message.id}`}
			layout={layout}
			initial={animateIn ? { opacity: 0, y: 12, scale: 0.98 } : false}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", stiffness: 450, damping: 28 }}
			onPointerDown={startLongPress}
			onPointerLeave={clearLongPress}
			onPointerCancel={clearLongPress}
			onPointerUp={clearLongPress}
			className={cn(
				"group relative flex gap-2.5 transition-shadow duration-300",
				mine && "flex-row-reverse",
				!showSender && "mt-1",
				highlighted && "rounded-lg ring-2 ring-ring ring-offset-2 ring-offset-background",
			)}
		>
			{showSender ? (
				<ChatAvatar user={message.sender} className="mt-0.5 size-8 shrink-0" />
			) : (
				<div aria-hidden="true" className="size-8 shrink-0" />
			)}
			<div
				className={cn(
					"relative flex max-w-[min(82%,36rem)] flex-col",
					mine && "items-end text-right",
				)}
			>
				{showSender && !mine && showSenderName && (
					<span className="mb-0.5 px-0.5 text-xs font-medium text-primary">
						{message.sender.display_name}
					</span>
				)}

				<div className="relative">
					{message.reply_to && (
						<ReplyPreview reference={message.reply_to} onClick={onReplyTo} />
					)}
					{message.is_deleted ? (
						<div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-xs italic text-muted-foreground">
							<AlertTriangle className="mr-1.5 inline size-3.5 text-destructive" />
							消息已被管理员删除
						</div>
					) : message.type === "image" && message.media ? (
						<button
							className={cn(
								"group/img relative block overflow-hidden rounded-2xl text-left",
								mine ? "rounded-tr-md" : "rounded-tl-md",
							)}
							onClick={() => onImage(message.media as ChatMedia)}
							type="button"
						>
							<img
								alt="聊天图片"
								className="max-h-80 w-auto max-w-full rounded-2xl object-cover"
								src={message.media.thumbnail || message.media.url}
							/>
							<BubbleTimestamp
								className="absolute bottom-1.5 right-1.5"
								mine={mine}
								time={message.created_at}
							/>
						</button>
					) : message.type === "tweet_share" ? (
						<div className="flex flex-col gap-1.5">
							{message.content && (
								<BubbleShell mine={mine}>
									<ChatMessageContent
										content={message.content}
										emote={mergedEmote}
										className="wrap-break-word"
									/>
									<BubbleTimestamp inline mine={mine} time={message.created_at} />
								</BubbleShell>
							)}
							<TweetShareCard
								tweet={message.shared_tweet ?? { id: message.id, is_deleted: true }}
							/>
						</div>
					) : (
						<BubbleShell mine={mine}>
							<ChatMessageContent
								content={message.content ?? ""}
								emote={mergedEmote}
								className="wrap-break-word"
							/>
							<BubbleTimestamp inline mine={mine} time={message.created_at} />
						</BubbleShell>
					)}

					{/* Hover 浮动微操作条 */}
					{!message.is_deleted && (
						<div
							className={cn(
								"absolute -top-3.5 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
								touchActionsVisible && "opacity-100",
								mine ? "left-1" : "right-1",
							)}
						>
							<EmojiPicker
								align={mine ? "start" : "end"}
								onSelect={handleAddReaction}
								selectedIds={selfReactionIds}
								showMyEmojis={false}
								trigger={
									<button
										aria-label={
											selfReactionIds.size >= 3
												? "消息表情数量已达上限"
												: "添加消息表情"
										}
										className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
										disabled={reactionBusy || selfReactionIds.size >= 3}
										type="button"
									>
										<Smile className="size-3.5" />
									</button>
								}
							/>
							{onReply && (
								<button
									aria-label="回复消息"
									className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
									onClick={onReply}
									type="button"
								>
									<Reply className="size-3.5" />
								</button>
							)}
							{message.type === "text" && (
								<button
									aria-label="复制消息"
									className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
									onClick={() => void copyText()}
									type="button"
								>
									{copied ? (
										<Check className="size-3.5 text-primary" />
									) : (
										<Copy className="size-3.5" />
									)}
								</button>
							)}
							{onDelete && (
								<button
									aria-label="删除违规消息"
									className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
									onClick={onDelete}
									type="button"
								>
									<Trash2 className="size-3.5" />
								</button>
							)}
						</div>
					)}
				</div>
				<ChatReactionBar
					disabled={reactionBusy}
					onToggle={handleToggleReaction}
					reactions={reactions}
				/>
			</div>
		</motion.article>
	);
}
/** 消息气泡容器：mine 为实色主色，other 为浅底。 */
function BubbleShell({ mine, children }: { mine: boolean; children: ReactNode }) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-end gap-x-1.5 px-3.5 py-2 text-left text-[0.95rem] leading-relaxed",
				mine
					? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
					: "rounded-2xl rounded-bl-md bg-secondary text-foreground",
			)}
		>
			{children}
		</div>
	);
}

/** 气泡内时间戳：随正文行尾流动，mine 半透明白、other 弱化灰。 */
function BubbleTimestamp({
	mine,
	time,
	inline = false,
	className,
}: {
	mine: boolean;
	time: string;
	inline?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"ml-auto inline-block whitespace-nowrap text-[11px] leading-5 tabular-nums",
				mine ? "text-primary-foreground/60" : "text-muted-foreground",
				inline && "float-right translate-y-0.5",
				className,
			)}
		>
			{formatTime(time)}
		</span>
	);
}
function ReplyPreview({
	reference,
	onClick,
}: {
	reference: ChatMessageReference;
	onClick?: () => void;
}) {
	const content = reference.is_deleted
		? "消息已删除"
		: reference.type === "image"
			? reference.content || "图片消息"
			: reference.type === "tweet_share"
				? reference.content || "分享了一条推文"
				: (reference.content ?? "文本消息");
	const className =
		"flex max-w-60 items-center gap-2 border-s-2 border-primary/60 bg-secondary px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-secondary/80";
	const body = (
		<>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold text-foreground/80">
					{reference.sender.display_name}
				</p>
				<p className="truncate">{content}</p>
			</div>
			{reference.type === "image" && reference.media && !reference.is_deleted && (
				<img
					alt="引用的聊天图片"
					className="size-10 shrink-0 rounded object-cover"
					src={reference.media.thumbnail ?? reference.media.url}
				/>
			)}
		</>
	);
	if (!onClick || reference.is_deleted)
		return <div className={cn(className, "mb-1 rounded-lg")}>{body}</div>;
	return (
		<button
			aria-label={`跳转到${reference.sender.display_name}的引用消息`}
			className={cn(className, "mb-1 rounded-lg hover:text-foreground")}
			onClick={onClick}
			type="button"
		>
			{body}
		</button>
	);
}

interface MessageComposerProps {
	conversationID: string;
	/** 落定到当前会话的待发分享；非空时优先展示分享 banner 并接管发送逻辑。 */
	pendingShare: PendingChatShare | null;
	replyTarget: ChatMessage | null;
	onCancelReply: () => void;
	onMessageSent?: () => void;
}

function MessageComposer({
	conversationID,
	pendingShare,
	replyTarget,
	onCancelReply,
	onMessageSent,
}: MessageComposerProps) {
	const [content, setContent] = useState("");
	const [images, setImages] = useState<PictureInput[]>([]);
	const [uploading, setUploading] = useState(false);
	const [resetNonce, setResetNonce] = useState(0);
	const clearPendingShare = useShareTweetStore((s) => s.clearPending);
	const { notifyTyping, notifyStopped } = useChatTypingBroadcaster(conversationID);

	useEffect(() => {
		if (content.trim()) {
			notifyTyping();
		} else {
			notifyStopped();
		}
	}, [content, notifyTyping, notifyStopped]);

	const send = useSendChatMessage();
	const sentImageIDsRef = useRef(new Set<string>());
	const replyAttachedRef = useRef(false);
	const replyTargetIDRef = useRef<string | undefined>(replyTarget?.id);

	const sendMessage = async () => {
		if (uploading || send.isPending) return;

		if (pendingShare) {
			try {
				await send.mutateAsync({
					id: conversationID,
					input: {
						type: "tweet_share",
						content: content.trim(),
						shared_tweet_id: pendingShare.tweet.id,
					},
					idempotencyKey: crypto.randomUUID(),
				});
				clearPendingShare();
				setContent("");
				setResetNonce((n) => n + 1);
				onMessageSent?.();
			} catch {
				toast.error("消息发送失败，请重试");
			}
			return;
		}

		if (!content.trim() && images.length === 0) return;

		const replyToID = replyTarget?.id;
		if (replyTargetIDRef.current !== replyToID) {
			replyTargetIDRef.current = replyToID;
			replyAttachedRef.current = false;
		}
		const trimmedContent = stripImagePlaceholders(content).trim();
		// 尚未发送成功的图片（排除重试时已成功发送过的）。
		const pendingImages = images.filter(
			(img): img is PictureInput & { id: string } =>
				!!img.id && !sentImageIDsRef.current.has(img.id),
		);
		try {
			// 当前消息模型按单条消息保存图片；引用只附着到本轮首条实际发送的消息。
			// 有图片时，文字说明随本轮最后一张图片合并发送（图文合一）；只有文字、没有图片时单独发一条文本消息。
			for (let i = 0; i < pendingImages.length; i++) {
				const img = pendingImages[i];
				const isLastImage = i === pendingImages.length - 1;
				const attachReply = Boolean(replyToID && !replyAttachedRef.current);
				await send.mutateAsync({
					id: conversationID,
					input: {
						type: "image",
						media_id: img.id,
						...(isLastImage && trimmedContent ? { content: trimmedContent } : {}),
						...(attachReply && replyToID ? { reply_to_id: replyToID } : {}),
					},
					idempotencyKey: crypto.randomUUID(),
				});
				sentImageIDsRef.current.add(img.id);
				if (attachReply) replyAttachedRef.current = true;
			}

			if (trimmedContent && pendingImages.length === 0) {
				const attachReply = Boolean(replyToID && !replyAttachedRef.current);
				await send.mutateAsync({
					id: conversationID,
					input: {
						type: "text",
						content: trimmedContent,
						...(attachReply && replyToID ? { reply_to_id: replyToID } : {}),
					},
					idempotencyKey: crypto.randomUUID(),
				});
				if (attachReply) replyAttachedRef.current = true;
			}

			sentImageIDsRef.current.clear();
			replyAttachedRef.current = false;
			setContent("");
			setImages([]);
			setResetNonce((n) => n + 1);
			onMessageSent?.();
		} catch {
			toast.error("消息发送失败，请重试");
		}
	};

	const canSend =
		!uploading &&
		!send.isPending &&
		(pendingShare ? true : Boolean(content.trim()) || images.length > 0);

	return (
		<div
			onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
				if (event.key === "Escape" && pendingShare) {
					event.preventDefault();
					clearPendingShare();
				} else if (event.key === "Escape" && replyTarget) {
					event.preventDefault();
					onCancelReply();
				}
			}}
			className="shrink-0 border-t border-border bg-card/70 p-4 backdrop-blur-xl md:p-5"
		>
			<div className="mx-auto max-w-4xl">
				{pendingShare ? (
					<div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
						<MessageSquareQuote className="size-4 shrink-0 text-muted-foreground" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium text-foreground">
								分享推文 @{pendingShare.tweet.authorUsername}
							</p>
							<p className="truncate text-xs text-muted-foreground">
								{pendingShare.tweet.content || "（图片推文）"}
							</p>
						</div>
						<button
							aria-label="取消分享"
							className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
							onClick={clearPendingShare}
							type="button"
						>
							<X className="size-3.5" />
						</button>
					</div>
				) : (
					replyTarget && (
						<div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
							<Reply className="size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="text-xs font-medium text-foreground">
									回复 {replyTarget.sender.display_name}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{replyTarget.type === "image"
										? replyTarget.content || "图片消息"
										: (replyTarget.content ?? "文本消息")}
								</p>
							</div>
							<button
								aria-label="取消回复"
								className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
								onClick={onCancelReply}
								type="button"
							>
								<X className="size-3.5" />
							</button>
						</div>
					)
				)}
				<RichCommentInput
					value={content}
					onChange={setContent}
					onSubmit={sendMessage}
					enableEmoji={true}
					enableImage={!pendingShare}
					inlineImages={!pendingShare}
					uploadPurpose="chat"
					submitOnEnter={true}
					compact={true}
layout="inline"
					placeholder="输入消息…"
					resetNonce={resetNonce}
					onImagesChange={setImages}
					onUploadingChange={setUploading}
					className="rounded-3xl border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
					toolbarEnd={
						<Button
							aria-label="发送消息"
							title="发送（Enter），Shift+Enter 换行"
							disabled={!canSend}
							onClick={() => void sendMessage()}
							size="icon"
							className={cn(
								"rounded-full transition-colors",
								canSend
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "bg-secondary text-muted-foreground",
							)}
						>
							{send.isPending ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<Send className="size-4" />
							)}
						</Button>
					}
				/>
			</div>
		</div>
	);
}

interface RoomDetailsProps {
	/** 当前会话。 */
	conversation: ChatConversation;
	/** 当前用户 ID。 */
	currentUserID: string;
	/** 当前有效成员。 */
	members: ChatMember[];
	/** 关闭详情抽屉。 */
	onClose: () => void;
}

function RoomDetails({ conversation, currentUserID, members, onClose }: RoomDetailsProps) {
	const [title, setTitle] = useState(conversation.title);
	const [inviteUsername, setInviteUsername] = useState("");
	const rename = useRenameChatConversation();
	const invite = useInviteChatMember();
	const remove = useRemoveChatMember();
	const mute = useSetChatMuted();
	const leave = useLeaveChatConversation();
	const currentMember = members.find((member) => member.user.id === currentUserID);
	const isOwner = currentMember?.role === "owner";
	useEffect(() => {
		setTitle(conversation.title);
	}, [conversation.title]);

	const saveTitle = async () => {
		if (conversation.kind !== "room" || !title.trim() || title === conversation.title) return;
		await rename.mutateAsync({ id: conversation.id, title: title.trim() });
	};

	const inviteUser = async () => {
		if (!inviteUsername.trim()) return;
		try {
			const user = await fetchChatUser(inviteUsername.trim());
			await invite.mutateAsync({ id: conversation.id, userId: user.id });
			setInviteUsername("");
			toast.success("成员已加入房间");
		} catch {
			toast.error("邀请失败", { description: "请确认用户名" });
		}
	};

	return (
		<motion.aside
			initial={{ x: "100%", opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: "100%", opacity: 0 }}
			transition={{ type: "spring", stiffness: 350, damping: 32 }}
			className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-border bg-card/95 backdrop-blur-xl sm:w-80 xl:static xl:z-auto xl:shadow-none"
		>
			<header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
				<h3 className="text-sm font-semibold text-foreground">会话详情</h3>
				<Button aria-label="关闭详情" onClick={onClose} size="icon-sm" variant="ghost">
					<X className="size-4" />
				</Button>
			</header>
			<div className="flex-1 space-y-5 overflow-y-auto p-4">
				<div className="rounded-2xl border border-border bg-secondary/40 p-4">
					<div className="mb-2.5 flex items-center gap-3">
						<ChatAvatar
							user={conversationTargetUser(conversation, currentUserID)}
							className="size-11"
						/>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-foreground">
								{conversationLabel(conversation, currentUserID)}
							</p>
							<p className="text-xs text-muted-foreground">
								{conversation.kind === "room" ? "群聊" : "私聊"}
							</p>
						</div>
					</div>
					{conversation.kind === "room" && isOwner && (
						<input
							aria-label="房间名称"
							className="mt-2 h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
							onBlur={() => void saveTitle()}
							onChange={(event) => setTitle(event.target.value)}
							value={title}
						/>
					)}
				</div>

				<div>
					<div className="mb-2.5 flex items-center justify-between px-1">
						<p className="text-xs text-muted-foreground">成员 · {members.length}</p>
						<Users className="size-3.5 text-muted-foreground" />
					</div>
					<div className="space-y-1">
						{members.map((member) => (
							<div
								className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-secondary/40"
								key={member.user.id}
							>
								<ChatAvatar user={member.user} className="size-7.5" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium text-foreground">
										{member.user.display_name}
									</p>
									<p className="truncate font-mono text-[11px] text-muted-foreground">
										@{member.user.username}
									</p>
								</div>
								{member.role === "owner" ? (
									<ShieldCheck className="size-4 text-muted-foreground" />
								) : (
									isOwner && (
										<button
											aria-label={`移除 ${member.user.display_name}`}
											className="text-muted-foreground transition hover:text-destructive"
											disabled={remove.isPending}
											onClick={() =>
												remove.mutate({
													id: conversation.id,
													userId: member.user.id,
												})
											}
											type="button"
										>
											<X className="size-3.5" />
										</button>
									)
								)}
							</div>
						))}
					</div>
				</div>

				{conversation.kind === "room" && currentMember && (
					<div className="rounded-2xl border border-dashed border-border p-3.5">
						<p className="mb-2 text-xs text-muted-foreground">邀请成员</p>
						<div className="flex gap-2">
							<input
								aria-label="邀请用户名"
								className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
								onChange={(event) => setInviteUsername(event.target.value)}
								onKeyDown={(event) => event.key === "Enter" && void inviteUser()}
								placeholder="username"
								value={inviteUsername}
							/>
							<Button
								disabled={invite.isPending}
								onClick={() => void inviteUser()}
								size="icon-sm"
								className="size-9 rounded-xl"
							>
								<Plus className="size-4" />
							</Button>
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							所有成员都可以邀请新成员
						</p>
					</div>
				)}

				<NotificationSettings
					muted={currentMember?.is_muted ?? false}
					onMute={(muted) => mute.mutate({ id: conversation.id, muted })}
				/>

				<div className="border-t border-border pt-3">
					<Button
						className="w-full justify-start rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={leave.isPending}
						onClick={async () => {
							try {
								await leave.mutateAsync(conversation.id);
								onClose();
							} catch {
								toast.error("无法离开会话", { description: "请稍后重试" });
							}
						}}
						variant="ghost"
						size="sm"
					>
						<LogOut className="mr-2 size-3.5" />
						离开会话
					</Button>
				</div>
			</div>
		</motion.aside>
	);
}

function NotificationSettings({
	muted,
	onMute,
}: {
	muted: boolean;
	onMute: (muted: boolean) => void;
}) {
	const push = useChatPushNotifications();
	const [showPreview, setShowPreview] = useState(false);
	const granted = push.permission === "granted";

	return (
		<div className="rounded-2xl border border-border bg-secondary/40 p-4">
			<div className="flex items-start gap-2.5">
				<div className="mt-0.5 rounded-lg bg-secondary p-1.5 text-muted-foreground">
					<Bell className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold text-foreground">桌面通知</p>
					<p className="mt-0.5 text-[11px] leading-normal text-muted-foreground">
						关闭标签页仍可收到消息提醒。
					</p>
					<Button
						className="mt-2.5 h-7.5 w-full justify-start rounded-lg text-xs"
						onClick={() => onMute(!muted)}
						size="sm"
						variant="ghost"
					>
						{muted ? (
							<BellOff className="mr-1.5 size-3.5" />
						) : (
							<Bell className="mr-1.5 size-3.5" />
						)}
						{muted ? "已静音此会话" : "静音此会话"}
					</Button>
					{push.enabled && (
						<label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
							<input
								checked={showPreview}
								onChange={(event) => {
									const next = event.target.checked;
									setShowPreview(next);
									void push.updatePreview(next);
								}}
								type="checkbox"
								className="rounded"
							/>
							显示消息摘要
						</label>
					)}
					<Button
						className="mt-2.5 h-7.5 w-full rounded-lg text-xs font-medium"
						disabled={push.busy || !push.enabled || !push.supported}
						onClick={() =>
							granted ? void push.disable() : void push.enable(showPreview)
						}
						size="sm"
						variant={granted ? "outline" : "default"}
					>
						{push.busy ? (
							<LoaderCircle className="size-3 animate-spin" />
						) : granted ? (
							"关闭浏览器通知"
						) : (
							"启用浏览器通知"
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}

function EmptyConversation({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="max-w-sm text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
					<MessageCircle className="size-5" />
				</div>
				<h2 className="mt-4 text-base font-semibold text-foreground">选择一个会话</h2>
				<p className="mt-1.5 text-sm leading-6 text-muted-foreground">
					从左侧选择私聊或群聊，或直接新建一个对话。
				</p>
				<div className="mt-5 flex justify-center">
					<Button onClick={onCreate} size="sm">
						<Plus className="size-4" />
						新建会话
					</Button>
				</div>
			</div>
		</div>
	);
}

function ImageLightbox({ media, onClose }: { media: ChatMedia; onClose: () => void }) {
	return (
		<div
			aria-label="图片预览"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			role="dialog"
		>
			<button
				aria-label="关闭图片预览"
				className="absolute inset-0 cursor-default bg-black/85 backdrop-blur-md"
				onClick={onClose}
				type="button"
			/>
			<button
				aria-label="关闭图片预览"
				className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
				onClick={onClose}
				type="button"
			>
				<X className="size-5" />
			</button>
			<img
				alt="聊天图片原图"
				className="relative z-10 max-h-[88dvh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
				src={media.url}
			/>
		</div>
	);
}

function ConversationEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="px-4 py-10 text-center">
			<MessageCircle className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-2.5 text-xs font-medium">还没有会话</p>
			<p className="mt-0.5 text-xs text-muted-foreground">发起一次私聊即可建立连接。</p>
			<Button
				className="mt-3.5 h-8 px-3 text-xs"
				onClick={onCreate}
				size="sm"
				variant="outline"
			>
				<Plus className="mr-1 size-3.5" />
				新建会话
			</Button>
		</div>
	);
}

function ConversationSkeleton() {
	return (
		<div className="space-y-2 px-1 py-1">
			{Array.from({ length: 5 }, (_, index) => (
				<div className="flex items-center gap-3 p-2" key={index}>
					<div className="size-9 animate-pulse rounded-full bg-secondary/80" />
					<div className="flex-1 space-y-1.5">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary/80" />
						<div className="h-2 w-1/2 animate-pulse rounded bg-secondary/60" />
					</div>
				</div>
			))}
		</div>
	);
}

function MessageSkeleton() {
	return (
		<div className="space-y-5">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					className={cn("flex gap-3", index % 2 === 1 && "flex-row-reverse")}
					key={index}
				>
					<div className="size-8 animate-pulse rounded-full bg-secondary/80" />
					<div className="h-12 w-1/2 animate-pulse rounded-2xl bg-secondary/60" />
				</div>
			))}
		</div>
	);
}

function MessageEmpty() {
	return (
		<div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
			<ImageIcon className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-2.5 text-sm font-medium text-foreground">这是新的会话</p>
			<p className="mt-1 text-xs text-muted-foreground">发送第一条消息或图片，开始对话。</p>
		</div>
	);
}

function useEmojiEmoteMap(): Record<string, { url: string; gif_url?: string; size?: number }> {
	const { data: groups = [] } = useAllEmojis();
	return useMemo(() => {
		const map: Record<string, { url: string; gif_url?: string; size?: number }> = {};
		for (const group of groups) {
			for (const emoji of group.emojis) {
				const key = `[${emoji.name}]`;
				map[key] = {
					url: emoji.url || emoji.text_content || "",
					gif_url: emoji.gif_url,
					size: emoji.meta?.size,
				};
			}
		}
		return map;
	}, [groups]);
}

export function conversationLabel(conversation: ChatConversation, currentUserID?: string) {
	if (conversation.title) return conversation.title;
	const participants =
		conversation.members?.filter((member) => member.user.id !== currentUserID) ?? [];
	if (conversation.kind === "direct") {
		return participants[0]?.user.display_name ?? conversation.owner.display_name;
	}
	return (
		participants.map((member) => member.user.display_name).join("、") ||
		conversation.owner.display_name
	);
}

export function conversationTargetUser(
	conversation: ChatConversation,
	currentUserID?: string,
): ChatUser {
	if (conversation.kind === "direct") {
		const participant = conversation.members?.find(
			(member) => member.user.id !== currentUserID,
		);
		if (participant) return participant.user;
		if (conversation.owner.id !== currentUserID) return conversation.owner;
	}
	return conversation.owner;
}

function messagePreview(message: ChatMessage) {
	if (message.is_deleted) return "消息已删除";
	if (message.type === "image") return message.content || "发送了一张图片";
	if (message.type === "tweet_share") return message.content || "分享了一条推文";
	return message.content ?? "";
}

function formatTime(value: string) {
	return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
		new Date(value),
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(
		new Date(value),
	);
}

function formatRelativeTime(value: string) {
	const date = new Date(value);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return formatTime(value);
	}
	if (diffDays === 1) {
		return "昨天";
	}
	if (diffDays < 7) {
		return `${diffDays}天前`;
	}
	return `${date.getMonth() + 1}/${date.getDate()}`;
}
