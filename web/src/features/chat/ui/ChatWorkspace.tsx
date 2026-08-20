import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { type PictureInput, RichCommentInput } from "@features/comments/ui/RichCommentInput";
import { useAllEmojis } from "@features/emojis/api/queries";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { EmojiText } from "@shared/ui/emoji-text";
import {
	AlertTriangle,
	ArrowDown,
	ArrowLeft,
	Bell,
	BellOff,
	ContactRound,
	Image as ImageIcon,
	LoaderCircle,
	LogOut,
	MessageCircle,
	PanelRight,
	Plus,
	Search,
	Send,
	ShieldCheck,
	Sparkles,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchChatUser } from "../api/client";
import {
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
	useRenameChatConversation,
	useSendChatMessage,
	useSetChatMuted,
} from "../api/queries";
import { useChatPushNotifications } from "../hooks/useChatPushNotifications";
import { useChatStream } from "../hooks/useChatStream";
import type {
	ChatConversation,
	ChatMedia,
	ChatMember,
	ChatMessage,
	ChatUser,
	ConversationKind,
} from "../model/types";

/** 聊天工作区：会话索引、消息流、房间成员抽屉与富文本 composer。 */
export function ChatWorkspace() {
	useChatStream();
	const { data: me } = useMe();
	const { data: conversationsPage, isLoading: conversationsLoading } = useChatConversations();
	const conversations = conversationsPage?.data ?? [];
	const [selectedID, setSelectedID] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showContacts, setShowContacts] = useState(false);

	useEffect(() => {
		if (!selectedID && conversations.length > 0) setSelectedID(conversations[0].id);
	}, [conversations, selectedID]);

	const selected = conversations.find((conversation) => conversation.id === selectedID) ?? null;
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return conversations;
		return conversations.filter((conversation) =>
			conversationLabel(conversation, me?.id).toLowerCase().includes(query),
		);
	}, [conversations, me?.id, search]);

	return (
		<div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl overflow-hidden border-x border-edge-hairline bg-background shadow-xl">
			{/* 侧边栏会话列表 */}
			<aside
				className={cn(
					"flex w-full shrink-0 flex-col border-r border-edge-hairline bg-background/50 backdrop-blur-xs md:flex md:w-80",
					selectedID && "hidden md:flex",
				)}
			>
				<ConversationIndex
					conversations={filtered}
					currentUserID={me?.id ?? ""}
					loading={conversationsLoading}
					selectedID={selectedID}
					search={search}
					showContacts={showContacts}
					showNew={showNew}
					onSearch={setSearch}
					onToggleContacts={() => setShowContacts((value) => !value)}
					onToggleNew={() => setShowNew((value) => !value)}
					onSelect={setSelectedID}
					onCreated={(id) => {
						setSelectedID(id);
						setShowContacts(false);
						setShowNew(false);
					}}
				/>
			</aside>

			{/* 主聊天区 */}
			<main
				className={cn(
					"flex min-h-0 min-w-0 flex-1 flex-col bg-background/80",
					!selectedID && "hidden md:flex",
				)}
			>
				{selected ? (
					<ConversationPanel
						conversation={selected}
						currentUserID={me?.id ?? ""}
						onBack={() => setSelectedID(null)}
						showDetails={showDetails}
						onToggleDetails={() => setShowDetails((value) => !value)}
					/>
				) : (
					<EmptyConversation />
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
	showContacts: boolean;
	showNew: boolean;
	onSearch: (value: string) => void;
	onToggleContacts: () => void;
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
	showContacts,
	showNew,
	onSearch,
	onToggleContacts,
	onToggleNew,
	onSelect,
	onCreated,
}: ConversationIndexProps) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 border-b border-edge-hairline px-4 pb-3 pt-5 md:px-5">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-neon-cyan">
							Private channel
						</p>
						<h1 className="mt-1 font-mono text-xl font-bold tracking-tight">
							{showContacts ? "联系人" : "聊天"}
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<Button
							aria-label={showContacts ? "返回会话" : "打开联系人"}
							className="size-8 rounded-full shadow-xs"
							onClick={onToggleContacts}
							size="icon"
							variant={showContacts ? "secondary" : "outline"}
						>
							{showContacts ? (
								<ArrowLeft className="size-4" />
							) : (
								<ContactRound className="size-4" />
							)}
						</Button>
						{!showContacts && (
							<Button
								aria-label="新建会话"
								className="size-8 rounded-full shadow-xs"
								onClick={onToggleNew}
								size="icon"
								variant={showNew ? "secondary" : "outline"}
							>
								<Plus
									className={cn(
										"size-4 transition-transform duration-200",
										showNew && "rotate-45",
									)}
								/>
							</Button>
						)}
					</div>
				</div>
				{!showContacts && (
					<div className="relative mt-3.5">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<input
							aria-label="搜索会话"
							className="h-9 w-full rounded-lg border border-input bg-secondary/30 pl-8.5 pr-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/15 placeholder:text-muted-foreground/70"
							onChange={(event) => onSearch(event.target.value)}
							placeholder="搜索用户名或房间"
							value={search}
						/>
					</div>
				)}
			</header>
			{showContacts ? (
				<ContactsPanel onCreated={onCreated} />
			) : (
				<>
					{showNew && <NewConversationForm onCreated={onCreated} />}
					<div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5">
						<div className="mb-2 flex items-center justify-between px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							<span>Conversations</span>
							<span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[9px]">
								{conversations.length}
							</span>
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
					</div>
				</>
			)}
		</div>
	);
}

function ContactsPanel({ onCreated }: { onCreated: (id: string) => void }) {
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const contactsQuery = useChatContacts(deferredSearch);
	const create = useCreateChatConversation();
	const [busyID, setBusyID] = useState<string | null>(null);
	const contacts = contactsQuery.data?.pages.flatMap((page) => page.data) ?? [];

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
		<section className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 border-b border-edge-hairline px-4 py-3">
				<p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
					Registered users
				</p>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						aria-label="搜索联系人"
						className="h-9 w-full rounded-lg border border-input bg-secondary/30 pl-8.5 pr-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/15 placeholder:text-muted-foreground/70"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="搜索用户名或展示名"
						value={search}
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
				{contactsQuery.isLoading ? (
					<ContactSkeleton />
				) : contactsQuery.isError ? (
					<p className="px-2 py-8 text-center text-xs text-destructive">
						联系人加载失败，请重试
					</p>
				) : contacts.length === 0 ? (
					<div className="px-2 py-8 text-center">
						<ContactRound className="mx-auto size-7 text-muted-foreground/50" />
						<p className="mt-2 text-xs text-muted-foreground">
							{deferredSearch ? "没有找到匹配的用户" : "暂时没有可联系的用户"}
						</p>
					</div>
				) : (
					<>
						<div className="space-y-1">
							{contacts.map((user) => (
								<div
									className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-edge-hairline hover:bg-secondary/35"
									key={user.id}
								>
									<Avatar user={user} className="size-10 shrink-0" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-semibold text-foreground">
											{user.display_name}
										</p>
										<p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
											@{user.username}
										</p>
									</div>
									<Button
										aria-label={`发起与${user.display_name}的私聊`}
										className="h-8 shrink-0 px-2.5 text-xs"
										disabled={busyID !== null}
										onClick={() => void startPrivateChat(user)}
										size="sm"
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
						{contactsQuery.hasNextPage && (
							<Button
								className="mt-3 w-full text-xs"
								disabled={contactsQuery.isFetchingNextPage}
								onClick={() => void contactsQuery.fetchNextPage()}
								variant="outline"
							>
								{contactsQuery.isFetchingNextPage ? (
									<LoaderCircle className="size-3.5 animate-spin" />
								) : (
									"加载更多"
								)}
							</Button>
						)}
					</>
				)}
			</div>
		</section>
	);
}

function ContactSkeleton() {
	return (
		<div className="space-y-2">
			{Array.from({ length: 5 }, (_, index) => (
				<div className="flex items-center gap-3 rounded-xl px-3 py-2.5" key={index}>
					<div className="size-10 animate-pulse rounded-full bg-secondary" />
					<div className="flex-1 space-y-1.5">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
						<div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
					</div>
				</div>
			))}
		</div>
	);
}
function NewConversationForm({ onCreated }: { onCreated: (id: string) => void }) {
	const [kind, setKind] = useState<ConversationKind>("direct");
	const [username, setUsername] = useState("");
	const [title, setTitle] = useState("");
	const [busy, setBusy] = useState(false);
	const create = useCreateChatConversation();
	const submit = async () => {
		if (username.trim().length < 3 || (kind === "room" && title.trim().length === 0)) return;
		setBusy(true);
		try {
			const user = await fetchChatUser(username.trim());
			const conversation = await create.mutateAsync({
				kind,
				title: kind === "room" ? title.trim() : undefined,
				participant_ids: [user.id],
			});
			onCreated(conversation.id);
			setUsername("");
			setTitle("");
		} catch {
			toast.error("无法创建会话", { description: "请确认用户名和房间名称" });
		} finally {
			setBusy(false);
		}
	};
	return (
		<section className="shrink-0 border-b border-edge-hairline bg-secondary/15 px-4 py-3">
			<div className="mb-2.5 flex items-center justify-between">
				<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
					New channel
				</p>
				<div className="flex rounded-md border border-edge-hairline bg-background/50 p-0.5">
					{(["direct", "room"] as const).map((value) => (
						<button
							className={cn(
								"rounded px-2.5 py-0.5 font-mono text-[10px] transition-colors",
								kind === value
									? "bg-primary text-primary-foreground font-medium shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
							key={value}
							onClick={() => setKind(value)}
							type="button"
						>
							{value === "direct" ? "私聊" : "房间"}
						</button>
					))}
				</div>
			</div>
			{kind === "room" && (
				<input
					aria-label="房间名称"
					className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/20"
					onChange={(event) => setTitle(event.target.value)}
					placeholder="房间名称"
					value={title}
				/>
			)}
			<div className="flex gap-2">
				<input
					aria-label="用户名"
					className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/20"
					onChange={(event) => setUsername(event.target.value)}
					onKeyDown={(event) => event.key === "Enter" && void submit()}
					placeholder="输入用户名发起会话"
					value={username}
				/>
				<Button
					disabled={busy}
					onClick={() => void submit()}
					size="sm"
					className="h-8 px-3 text-xs"
				>
					{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : "发起"}
				</Button>
			</div>
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
	const lastTime = conversation.last_message?.created_at || conversation.updated_at;

	return (
		<button
			className={cn(
				"group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
				active
					? "bg-accent/80 border border-primary/20 text-foreground shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-primary"
					: "hover:bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent",
			)}
			onClick={onClick}
			type="button"
		>
			<div className="relative shrink-0">
				<Avatar user={avatarUser} className="size-10" />
				{conversation.kind === "direct" && (
					<span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-neon-green" />
				)}
			</div>
			<span className="min-w-0 flex-1">
				<span className="flex items-center justify-between gap-1.5">
					<strong
						className={cn(
							"truncate text-xs font-semibold",
							active ? "text-foreground" : "text-foreground/90",
						)}
					>
						{conversationLabel(conversation, currentUserID)}
					</strong>
					{lastTime && (
						<time className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
							{formatRelativeTime(lastTime)}
						</time>
					)}
				</span>
				<span className="mt-1 flex items-center justify-between gap-2">
					<span
						className={cn(
							"truncate text-[11px] leading-tight",
							active ? "text-muted-foreground" : "text-muted-foreground/80",
						)}
					>
						{conversation.last_message
							? messagePreview(conversation.last_message)
							: "还没有消息，打个招呼吧"}
					</span>
					{conversation.unread_count > 0 && (
						<span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[9px] font-bold text-primary-foreground shadow-xs">
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
	/** 是否显示成员详情。 */
	showDetails: boolean;
	/** 切换成员详情抽屉。 */
	onToggleDetails: () => void;
}

function ConversationPanel({
	conversation,
	currentUserID,
	onBack,
	showDetails,
	onToggleDetails,
}: ConversationPanelProps) {
	const { data: messagePage, isLoading: messagesLoading } = useChatMessages(conversation.id);
	const { data: memberData } = useChatMembers(conversation.id);
	const members = memberData ?? [];
	const canManage = useHasPermission("chat:manage");
	const deleteMessage = useDeleteChatMessage();
	const read = useMarkChatRead();
	const [lightbox, setLightbox] = useState<ChatMedia | null>(null);

	const messages = useMemo(() => [...(messagePage?.data ?? [])].reverse(), [messagePage?.data]);
	const lastMessage = messages.at(-1);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [showScrollBottom, setShowScrollBottom] = useState(false);

	const scrollToBottom = useCallback((smooth = true) => {
		messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
	}, []);

	// 监听已读上报
	useEffect(() => {
		if (lastMessage?.id && conversation.unread_count > 0) {
			read.mutate({ id: conversation.id, messageId: lastMessage.id });
		}
	}, [conversation.id, conversation.unread_count, lastMessage?.id, read.mutate]);

	// 收到新消息或切换会话时自动滚动到底部
	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom(false);
		}
	}, [messages.length, scrollToBottom]);

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceToBottom = scrollHeight - scrollTop - clientHeight;
		setShowScrollBottom(distanceToBottom > 150);
	}, []);

	// 全局构建 emote 映射表，支持消息文本中的表情解析
	const emoteMap = useEmojiEmoteMap();

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			{/* 顶栏 Header */}
			<header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-edge-hairline bg-background/80 px-4 backdrop-blur-md md:px-6">
				<div className="flex min-w-0 items-center gap-2.5">
					<Button
						aria-label="返回会话列表"
						className="size-8 md:hidden"
						onClick={onBack}
						size="icon-sm"
						variant="ghost"
					>
						<ArrowLeft className="size-4" />
					</Button>
					<Avatar
						user={conversationTargetUser(conversation, currentUserID)}
						className="size-8 shrink-0"
					/>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h2 className="truncate text-sm font-semibold">
								{conversationLabel(conversation, currentUserID)}
							</h2>
							<span className="font-mono text-[9px] uppercase tracking-[0.18em] text-neon-cyan">
								{conversation.kind === "room" ? "Room" : "DM"}
							</span>
						</div>
						<p className="hidden font-mono text-[10px] text-muted-foreground sm:block">
							{conversation.kind === "room"
								? `${members.length} 位成员`
								: "端到端会话通道"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="hidden items-center gap-1.5 rounded-full border border-edge-hairline/60 bg-secondary/30 px-2.5 py-1 text-muted-foreground sm:flex">
						<span className="size-1.5 rounded-full bg-neon-green" />
						<span className="font-mono text-[9px] uppercase tracking-[0.14em]">
							secure channel
						</span>
					</div>
					<Button
						aria-label="打开会话详情"
						className="size-8"
						onClick={onToggleDetails}
						size="icon-sm"
						variant={showDetails ? "secondary" : "ghost"}
					>
						<PanelRight className="size-4" />
					</Button>
				</div>
			</header>

			{/* 主内容：消息列表 + 底部输入框 + 右侧抽屉 */}
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<section className="flex min-h-0 min-w-0 flex-1 flex-col">
					{/* 消息可滚动区 */}
					<div
						ref={scrollContainerRef}
						onScroll={handleScroll}
						className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8"
					>
						<div className="mx-auto max-w-3xl space-y-4">
							<div className="my-2 flex items-center justify-center">
								<span className="rounded-full border border-edge-hairline/60 bg-secondary/50 px-3 py-0.5 font-mono text-[10px] text-muted-foreground shadow-2xs">
									{formatDate(conversation.created_at)}
								</span>
							</div>

							{messagesLoading ? (
								<MessageSkeleton />
							) : messages.length === 0 ? (
								<MessageEmpty />
							) : (
								messages.map((message) => (
									<MessageBubble
										currentUserID={currentUserID}
										emoteMap={emoteMap}
										key={message.id}
										message={message}
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
									/>
								))
							)}
							<div ref={messagesEndRef} className="h-0" />
						</div>
					</div>

					{/* 滚到底部悬浮快捷按钮 */}
					{showScrollBottom && (
						<div className="pointer-events-none absolute bottom-24 right-6 z-10 md:right-10">
							<Button
								aria-label="回到底部"
								className="pointer-events-auto size-8 rounded-full bg-background/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105"
								onClick={() => scrollToBottom(true)}
								size="icon-sm"
								variant="outline"
							>
								<ArrowDown className="size-4" />
							</Button>
						</div>
					)}

					{/* 底部输入框 */}
					<MessageComposer
						conversationID={conversation.id}
						onMessageSent={() => scrollToBottom(true)}
					/>
				</section>

				{/* 房间成员详情抽屉 */}
				{showDetails && (
					<RoomDetails
						conversation={conversation}
						currentUserID={currentUserID}
						members={members}
						onClose={onToggleDetails}
					/>
				)}
			</div>

			{/* 图片大图预览浮层 */}
			{lightbox && <ImageLightbox media={lightbox} onClose={() => setLightbox(null)} />}
		</div>
	);
}

function MessageBubble({
	message,
	currentUserID,
	emoteMap,
	onDelete,
	onImage,
}: {
	message: ChatMessage;
	currentUserID: string;
	emoteMap: Record<string, { url: string; gif_url?: string; size?: number }>;
	onDelete?: () => void;
	onImage: (media: ChatMedia) => void;
}) {
	const mine = message.sender.id === currentUserID;

	return (
		<article className={cn("group flex gap-2.5", mine && "flex-row-reverse")}>
			<Avatar user={message.sender} className="size-8 shrink-0 mt-0.5" />
			<div
				className={cn(
					"flex max-w-[min(82%,36rem)] flex-col",
					mine && "items-end text-right",
				)}
			>
				<div className={cn("mb-1 flex items-baseline gap-2 px-0.5", mine && "justify-end")}>
					{!mine && (
						<span className="text-xs font-semibold text-foreground/90">
							{message.sender.display_name}
						</span>
					)}
					<time className="font-mono text-[10px] text-muted-foreground/70">
						{formatTime(message.created_at)}
					</time>
					{onDelete && !message.is_deleted && (
						<button
							aria-label="删除违规消息"
							className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
							onClick={onDelete}
							type="button"
						>
							<Trash2 className="size-3" />
						</button>
					)}
				</div>

				{message.is_deleted ? (
					<div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-xs italic text-muted-foreground">
						<AlertTriangle className="mr-1.5 inline size-3.5 text-destructive" />
						消息已被管理员删除
					</div>
				) : message.type === "image" && message.media ? (
					<button
						className="group/img block overflow-hidden rounded-2xl border border-edge-hairline bg-secondary/25 text-left shadow-xs transition hover:border-neon-cyan/50 hover:shadow-md"
						onClick={() => onImage(message.media as ChatMedia)}
						type="button"
					>
						<img
							alt="聊天图片"
							className="max-h-80 w-auto max-w-full object-cover transition duration-200 group-hover/img:scale-[1.01]"
							src={message.media.thumbnail || message.media.url}
						/>
						<span className="flex items-center gap-2 border-t border-edge-hairline/40 bg-background/50 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
							<ImageIcon className="size-3" />
							{formatBytes(message.media.size)}
							{message.media.width && message.media.height && (
								<>
									<span className="text-edge-hairline">·</span>
									{message.media.width} × {message.media.height}
								</>
							)}
						</span>
					</button>
				) : (
					<div
						className={cn(
							"rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed shadow-2xs select-text",
							mine
								? "rounded-tr-xs bg-primary text-primary-foreground"
								: "rounded-tl-xs bg-secondary/70 border border-edge-hairline/50 text-foreground",
						)}
					>
						<p className="whitespace-pre-wrap wrap-break-word">
							<EmojiText text={message.content ?? ""} emote={emoteMap} />
						</p>
					</div>
				)}
			</div>
		</article>
	);
}

function MessageComposer({
	conversationID,
	onMessageSent,
}: {
	conversationID: string;
	onMessageSent?: () => void;
}) {
	const [content, setContent] = useState("");
	const [images, setImages] = useState<PictureInput[]>([]);
	const [uploading, setUploading] = useState(false);
	const [resetNonce, setResetNonce] = useState(0);

	const send = useSendChatMessage();

	const sendMessage = async () => {
		if (uploading || send.isPending) return;
		if (!content.trim() && images.length === 0) return;

		try {
			// 先按顺序发送已完成上传的图片消息
			for (const img of images) {
				if (img.id) {
					await send.mutateAsync({
						id: conversationID,
						input: { type: "image", media_id: img.id },
						idempotencyKey: crypto.randomUUID(),
					});
				}
			}

			// 如果有文本内容，发送文本消息
			if (content.trim()) {
				await send.mutateAsync({
					id: conversationID,
					input: { type: "text", content: content.trim() },
					idempotencyKey: crypto.randomUUID(),
				});
			}

			// 发送完成重置表单并触发滚动
			setContent("");
			setImages([]);
			setResetNonce((n) => n + 1);
			onMessageSent?.();
		} catch {
			toast.error("消息发送失败，请重试");
		}
	};

	const canSend = !uploading && !send.isPending && (Boolean(content.trim()) || images.length > 0);

	return (
		<div className="shrink-0 border-t border-edge-hairline bg-background/95 p-3 backdrop-blur-md md:p-4">
			<div className="mx-auto max-w-3xl">
				<RichCommentInput
					value={content}
					onChange={setContent}
					onSubmit={sendMessage}
					enableEmoji={true}
					enableImage={true}
					uploadPurpose="chat"
					submitOnEnter={true}
					compact={true}
					placeholder="写点什么… Enter 发送，Shift+Enter 换行"
					resetNonce={resetNonce}
					onImagesChange={setImages}
					onUploadingChange={setUploading}
					inputClassName="min-h-12 max-h-36 py-2 px-3 text-sm leading-relaxed"
					className="border-input/80 bg-secondary/20 transition-all focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/15 rounded-xl"
					toolbarEnd={
						<div className="flex items-center gap-2">
							<span className="hidden font-mono text-[10px] text-muted-foreground/60 sm:inline">
								Enter 发送 / Shift+Enter 换行
							</span>
							<Button
								aria-label="发送消息"
								disabled={!canSend}
								onClick={() => void sendMessage()}
								size="sm"
								className="h-7 gap-1.5 px-3 text-xs shadow-xs"
							>
								{send.isPending ? (
									<LoaderCircle className="size-3.5 animate-spin" />
								) : (
									<>
										<Send className="size-3" />
										<span>发送</span>
									</>
								)}
							</Button>
						</div>
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
		<aside className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-edge-hairline bg-background shadow-2xl sm:w-80 xl:static xl:z-auto xl:shadow-none">
			<header className="flex h-14 shrink-0 items-center justify-between border-b border-edge-hairline px-5">
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
						Inspector
					</p>
					<h3 className="text-sm font-semibold">会话详情</h3>
				</div>
				<Button aria-label="关闭详情" onClick={onClose} size="icon-sm" variant="ghost">
					<X className="size-4" />
				</Button>
			</header>
			<div className="flex-1 space-y-5 overflow-y-auto p-4">
				<div className="rounded-xl border border-edge-hairline bg-secondary/15 p-3.5">
					<div className="mb-2.5 flex items-center gap-3">
						<Avatar
							user={conversationTargetUser(conversation, currentUserID)}
							className="size-11"
						/>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold">
								{conversationLabel(conversation, currentUserID)}
							</p>
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								{conversation.kind === "room" ? "Private room" : "Direct channel"}
							</p>
						</div>
					</div>
					{conversation.kind === "room" && isOwner && (
						<input
							aria-label="房间名称"
							className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:border-neon-cyan"
							onBlur={() => void saveTitle()}
							onChange={(event) => setTitle(event.target.value)}
							value={title}
						/>
					)}
				</div>

				<div>
					<div className="mb-2.5 flex items-center justify-between px-1">
						<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
							Members · {members.length}
						</p>
						<Users className="size-3.5 text-muted-foreground" />
					</div>
					<div className="space-y-1.5">
						{members.map((member) => (
							<div
								className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-secondary/30"
								key={member.user.id}
							>
								<Avatar user={member.user} className="size-7" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium">
										{member.user.display_name}
									</p>
									<p className="font-mono text-[9px] text-muted-foreground">
										@{member.user.username}
									</p>
								</div>
								{member.role === "owner" ? (
									<ShieldCheck className="size-3.5 text-neon-cyan" />
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

				{conversation.kind === "room" && isOwner && (
					<div className="rounded-xl border border-dashed border-edge-hairline p-3">
						<p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Invite member
						</p>
						<div className="flex gap-2">
							<input
								aria-label="邀请用户名"
								className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-neon-cyan"
								onChange={(event) => setInviteUsername(event.target.value)}
								onKeyDown={(event) => event.key === "Enter" && void inviteUser()}
								placeholder="username"
								value={inviteUsername}
							/>
							<Button
								disabled={invite.isPending}
								onClick={() => void inviteUser()}
								size="icon-sm"
								className="size-8"
							>
								<Plus className="size-3.5" />
							</Button>
						</div>
					</div>
				)}

				<NotificationSettings
					muted={currentMember?.is_muted ?? false}
					onMute={(muted) => mute.mutate({ id: conversation.id, muted })}
				/>

				<div className="border-t border-edge-hairline pt-3">
					<Button
						className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={
							leave.isPending ||
							(conversation.kind === "room" &&
								members.some(
									(member) =>
										member.role === "owner" &&
										member.user.id === conversation.owner.id,
								))
						}
						onClick={() => void leave.mutateAsync(conversation.id)}
						variant="ghost"
						size="sm"
					>
						<LogOut className="mr-2 size-3.5" />
						离开会话
					</Button>
				</div>
			</div>
		</aside>
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
		<section className="rounded-xl border border-edge-hairline bg-secondary/15 p-3.5">
			<div className="flex items-start gap-2.5">
				<div className="mt-0.5 rounded-md bg-neon-cyan/10 p-1.5 text-neon-cyan">
					<Bell className="size-3.5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-medium">桌面通知</p>
					<p className="mt-0.5 text-[11px] leading-normal text-muted-foreground">
						关闭标签页仍可收到消息提醒。
					</p>
					<Button
						className="mt-2.5 h-7 w-full justify-start text-xs"
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
						className="mt-2.5 h-7 w-full text-xs"
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
		</section>
	);
}

function ImageLightbox({ media, onClose }: { media: ChatMedia; onClose: () => void }) {
	return (
		<div
			aria-label="图片预览"
			aria-modal="true"
			className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
			role="dialog"
		>
			<button
				aria-label="关闭图片预览"
				className="absolute inset-0 cursor-default bg-black/85 backdrop-blur-sm"
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
				className="relative z-10 max-h-[88dvh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
				src={media.url}
			/>
		</div>
	);
}

function Avatar({ user, className }: { user: ChatUser; className?: string }) {
	return user.avatar_url ? (
		<img
			alt={`${user.display_name} 的头像`}
			className={cn("rounded-full object-cover ring-1 ring-edge-hairline/60", className)}
			src={user.avatar_url}
		/>
	) : (
		<div
			className={cn(
				"flex items-center justify-center rounded-full bg-neon-purple/15 font-mono text-xs font-bold text-neon-purple ring-1 ring-neon-purple/25",
				className,
			)}
		>
			{user.display_name.slice(0, 1).toUpperCase()}
		</div>
	);
}

function EmptyConversation() {
	return (
		<div className="flex flex-1 items-center justify-center p-8">
			<div className="max-w-sm text-center">
				<div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan shadow-sm">
					<MessageCircle className="size-6" />
				</div>
				<p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
					No channel selected
				</p>
				<h2 className="mt-1.5 text-xl font-semibold">选择一个会话</h2>
				<p className="mt-2 text-xs leading-5 text-muted-foreground">
					从左侧选择私聊或房间。消息、图片和表情将在多端实时同步。
				</p>
			</div>
		</div>
	);
}

function ConversationEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="px-4 py-10 text-center">
			<Sparkles className="mx-auto size-5 text-neon-cyan" />
			<p className="mt-2.5 text-xs font-medium">还没有会话</p>
			<p className="mt-0.5 text-[11px] text-muted-foreground">发起一次私聊即可建立连接。</p>
			<Button
				className="mt-3.5 h-7 px-3 text-xs"
				onClick={onCreate}
				size="sm"
				variant="outline"
			>
				<Plus className="mr-1 size-3" />
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
		<div className="rounded-xl border border-dashed border-edge-hairline/80 px-6 py-10 text-center bg-secondary/10">
			<ImageIcon className="mx-auto size-5 text-muted-foreground/60" />
			<p className="mt-2.5 text-xs font-medium text-foreground/80">这是新的会话</p>
			<p className="mt-0.5 text-[11px] text-muted-foreground">
				发送第一条消息或图片，建立连接。
			</p>
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

function conversationLabel(conversation: ChatConversation, currentUserID?: string) {
	if (conversation.title) return conversation.title;
	const participant = conversation.members?.find((member) => member.user.id !== currentUserID);
	if (participant) return participant.user.display_name;
	return (
		conversation.members?.map((member) => member.user.display_name).join("、") ||
		conversation.owner.display_name
	);
}

function conversationTargetUser(conversation: ChatConversation, currentUserID?: string): ChatUser {
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
	if (message.type === "image") return "发送了一张图片";
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

function formatBytes(value: number) {
	if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
	return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
