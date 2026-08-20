import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Textarea } from "@shared/ui/base/textarea";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	BellOff,
	Check,
	Image as ImageIcon,
	LoaderCircle,
	LogOut,
	MessageCircle,
	PanelRight,
	Paperclip,
	Plus,
	Search,
	Send,
	ShieldCheck,
	Sparkles,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchChatUser } from "../api/client";
import {
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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** 聊天工作区：会话索引、消息流、房间成员抽屉和图片消息 composer。 */
export function ChatWorkspace() {
	useChatStream();
	const { data: me } = useMe();
	const { data: conversationsPage, isLoading: conversationsLoading } = useChatConversations();
	const conversations = conversationsPage?.data ?? [];
	const [selectedID, setSelectedID] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [showNew, setShowNew] = useState(false);

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
		<div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl overflow-hidden border-x border-edge-hairline bg-background">
			<aside
				className={cn(
					"w-full shrink-0 flex-col border-r border-edge-hairline md:flex md:w-80",
					selectedID && "hidden",
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
					onSelect={setSelectedID}
					onCreated={setSelectedID}
				/>
			</aside>

			<main className={cn("min-w-0 flex-1 flex-col", !selectedID && "hidden md:flex")}>
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
	return (
		<>
			<header className="border-b border-edge-hairline px-5 pb-4 pt-6">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon-cyan">
							Private channel
						</p>
						<h1 className="mt-2 font-mono text-2xl font-bold tracking-tight">聊天</h1>
					</div>
					<Button
						aria-label="新建会话"
						className="size-9 rounded-full"
						onClick={onToggleNew}
						size="icon"
						variant="outline"
					>
						<Plus className="size-4" />
					</Button>
				</div>
				<div className="relative mt-5">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						aria-label="搜索会话"
						className="h-10 w-full rounded-md border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
						onChange={(event) => onSearch(event.target.value)}
						placeholder="搜索用户名或房间"
						value={search}
					/>
				</div>
			</header>
			{showNew && <NewConversationForm onCreated={onCreated} />}
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
				<div className="mb-2 flex items-center justify-between px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
					<span>Conversations</span>
					<span>{conversations.length}</span>
				</div>
				{loading ? (
					<ConversationSkeleton />
				) : conversations.length === 0 ? (
					<ConversationEmpty onCreate={onToggleNew} />
				) : (
					conversations.map((conversation) => (
						<ConversationRow
							active={conversation.id === selectedID}
							conversation={conversation}
							currentUserID={currentUserID}
							key={conversation.id}
							onClick={() => onSelect(conversation.id)}
						/>
					))
				)}
			</div>
		</>
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
		<section className="border-b border-edge-hairline bg-secondary/20 px-4 py-4">
			<div className="mb-3 flex items-center justify-between">
				<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
					New channel
				</p>
				<div className="flex rounded-md border border-edge-hairline p-0.5">
					{(["direct", "room"] as const).map((value) => (
						<button
							className={cn(
								"rounded px-2 py-1 font-mono text-[10px] uppercase",
								kind === value
									? "bg-foreground text-background"
									: "text-muted-foreground",
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
					className="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-neon-cyan"
					onChange={(event) => setTitle(event.target.value)}
					placeholder="房间名称"
					value={title}
				/>
			)}
			<div className="flex gap-2">
				<input
					aria-label="用户名"
					className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-neon-cyan"
					onChange={(event) => setUsername(event.target.value)}
					onKeyDown={(event) => event.key === "Enter" && void submit()}
					placeholder="输入用户名"
					value={username}
				/>
				<Button disabled={busy} onClick={() => void submit()} size="sm">
					{busy ? <LoaderCircle className="size-4 animate-spin" /> : "开始"}
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
	const avatar = conversation.last_message?.sender;
	return (
		<button
			className={cn(
				"group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition",
				active ? "bg-foreground text-background shadow-sm" : "hover:bg-secondary/70",
			)}
			onClick={onClick}
			type="button"
		>
			<Avatar user={avatar ?? conversation.owner} className="size-10" />
			<span className="min-w-0 flex-1">
				<span className="flex items-center justify-between gap-2">
					<strong className="truncate text-sm font-semibold">
						{conversationLabel(conversation, currentUserID)}
					</strong>
					{conversation.unread_count > 0 && (
						<span
							className={cn(
								"min-w-5 rounded-full px-1.5 text-center font-mono text-[10px]",
								active ? "bg-neon-cyan text-slate-950" : "bg-neon-blue text-white",
							)}
						>
							{conversation.unread_count > 99 ? "99+" : conversation.unread_count}
						</span>
					)}
				</span>
				<span
					className={cn(
						"mt-1 block truncate text-xs",
						active ? "text-background/65" : "text-muted-foreground",
					)}
				>
					{conversation.last_message
						? messagePreview(conversation.last_message)
						: "还没有消息，打个招呼吧"}
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
	const messages = [...(messagePage?.data ?? [])].reverse();
	const lastMessage = messages.at(-1);
	useEffect(() => {
		if (lastMessage?.id && conversation.unread_count > 0)
			read.mutate({ id: conversation.id, messageId: lastMessage.id });
	}, [conversation.id, conversation.unread_count, lastMessage?.id, read.mutate]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex shrink-0 items-center gap-3 border-b border-edge-hairline px-4 py-3 md:px-6">
				<Button
					aria-label="返回会话列表"
					className="md:hidden"
					onClick={onBack}
					size="icon-sm"
					variant="ghost"
				>
					<ArrowLeft className="size-4" />
				</Button>
				<div className="min-w-0 flex-1">
					<p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neon-cyan">
						{conversation.kind === "room" ? "Private room" : "Direct message"}
					</p>
					<h2 className="truncate text-lg font-semibold">
						{conversationLabel(conversation)}
					</h2>
				</div>
				<div className="hidden items-center gap-1 text-muted-foreground sm:flex">
					<span className="size-2 rounded-full bg-neon-green" />
					<span className="font-mono text-[10px] uppercase tracking-[0.16em]">
						secure channel
					</span>
				</div>
				<Button
					aria-label="打开会话详情"
					onClick={onToggleDetails}
					size="icon-sm"
					variant={showDetails ? "secondary" : "ghost"}
				>
					<PanelRight className="size-4" />
				</Button>
			</header>
			<div className="flex min-h-0 flex-1">
				<section className="flex min-w-0 flex-1 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
						<div className="mx-auto max-w-3xl">
							<div className="mb-7 flex items-center gap-3 text-muted-foreground">
								<div className="h-px flex-1 bg-edge-hairline" />
								<span className="font-mono text-[10px] uppercase tracking-[0.2em]">
									{formatDate(conversation.created_at)}
								</span>
								<div className="h-px flex-1 bg-edge-hairline" />
							</div>
							{messagesLoading ? (
								<MessageSkeleton />
							) : messages.length === 0 ? (
								<MessageEmpty />
							) : (
								<div className="space-y-5">
									{messages.map((message) => (
										<MessageBubble
											currentUserID={currentUserID}
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
									))}
								</div>
							)}
						</div>
					</div>
					<MessageComposer conversationID={conversation.id} />
				</section>
				{showDetails && (
					<RoomDetails
						conversation={conversation}
						currentUserID={currentUserID}
						members={members}
						onClose={onToggleDetails}
					/>
				)}
			</div>
			{lightbox && <ImageLightbox media={lightbox} onClose={() => setLightbox(null)} />}
		</div>
	);
}

function MessageBubble({
	message,
	currentUserID,
	onDelete,
	onImage,
}: {
	message: ChatMessage;
	currentUserID: string;
	onDelete?: () => void;
	onImage: (media: ChatMedia) => void;
}) {
	const mine = message.sender.id === currentUserID;
	return (
		<article className={cn("flex gap-3", mine && "flex-row-reverse")}>
			<Avatar user={message.sender} className="size-8 shrink-0" />
			<div className={cn("max-w-[min(78%,38rem)]", mine && "items-end text-right")}>
				<div className={cn("mb-1 flex items-baseline gap-2", mine && "justify-end")}>
					<span className="text-xs font-semibold">{message.sender.display_name}</span>
					<time className="font-mono text-[10px] text-muted-foreground">
						{formatTime(message.created_at)}
					</time>
					{onDelete && !message.is_deleted && (
						<button
							aria-label="删除违规消息"
							className="text-muted-foreground transition hover:text-destructive"
							onClick={onDelete}
							type="button"
						>
							<Trash2 className="size-3" />
						</button>
					)}
				</div>
				{message.is_deleted ? (
					<div className="rounded-lg border border-dashed border-destructive/40 px-4 py-3 text-sm italic text-muted-foreground">
						<AlertTriangle className="mr-2 inline size-3.5 text-destructive" />
						消息已被管理员删除
					</div>
				) : message.type === "image" && message.media ? (
					<button
						className="group block overflow-hidden rounded-xl border border-edge-hairline bg-secondary/30 text-left shadow-sm transition hover:border-neon-cyan hover:shadow-lg hover:shadow-neon-cyan/10"
						onClick={() => onImage(message.media as ChatMedia)}
						type="button"
					>
						<img
							alt="聊天图片"
							className="max-h-96 w-auto max-w-full object-cover transition duration-300 group-hover:scale-[1.02]"
							src={message.media.thumbnail || message.media.url}
						/>
						<span className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] text-muted-foreground">
							<ImageIcon className="size-3" />
							{formatBytes(message.media.size)}
							<span className="text-edge-hairline">·</span>
							{message.media.width ?? "?"} × {message.media.height ?? "?"}
						</span>
					</button>
				) : (
					<p
						className={cn(
							"rounded-2xl px-4 py-3 text-left text-sm leading-6",
							mine
								? "rounded-tr-sm bg-foreground text-background"
								: "rounded-tl-sm bg-secondary/70",
						)}
					>
						{message.content}
					</p>
				)}
			</div>
		</article>
	);
}

function MessageComposer({ conversationID }: { conversationID: string }) {
	const [content, setContent] = useState("");
	const [attachment, setAttachment] = useState<{
		file: File;
		progress: number;
		mediaID?: string;
		preview: string;
		error?: string;
	} | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const send = useSendChatMessage();
	const upload = useChunkedUpload({ purpose: "chat" });
	const chooseImage = async (file: File) => {
		if (
			!file.type.startsWith("image/") ||
			!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
		) {
			toast.error("只支持 JPEG、PNG、WebP、GIF 图片");
			return;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			toast.error("图片不能超过 10 MB");
			return;
		}
		const next = { file, progress: 0, preview: URL.createObjectURL(file) };
		setAttachment(next);
		try {
			const result = await upload.uploadFile(file, ({ percent }) =>
				setAttachment((current) => (current ? { ...current, progress: percent } : current)),
			);
			setAttachment((current) =>
				current ? { ...current, progress: 100, mediaID: result.file_id } : current,
			);
		} catch {
			setAttachment((current) =>
				current ? { ...current, error: "上传失败，可重试" } : current,
			);
		}
	};
	const sendMessage = async () => {
		if (attachment && !attachment.mediaID) return;
		if (attachment?.mediaID) {
			await send.mutateAsync({
				id: conversationID,
				input: { type: "image", media_id: attachment.mediaID },
				idempotencyKey: crypto.randomUUID(),
			});
			URL.revokeObjectURL(attachment.preview);
			setAttachment(null);
		}
		if (content.trim()) {
			await send.mutateAsync({
				id: conversationID,
				input: { type: "text", content: content.trim() },
				idempotencyKey: crypto.randomUUID(),
			});
			setContent("");
		}
	};
	return (
		<div className="shrink-0 border-t border-edge-hairline bg-background/90 px-4 pb-4 pt-3 backdrop-blur-md md:px-8">
			<div className="mx-auto max-w-3xl">
				{attachment && (
					<div className="mb-3 flex items-center gap-3 rounded-lg border border-edge-hairline bg-secondary/30 p-2">
						<img
							alt="待发送图片"
							className="size-14 rounded-md object-cover"
							src={attachment.preview}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<span className="truncate text-xs font-medium">
									{attachment.file.name}
								</span>
								<button
									aria-label="移除图片"
									className="text-muted-foreground hover:text-foreground"
									onClick={() => {
										URL.revokeObjectURL(attachment.preview);
										setAttachment(null);
									}}
									type="button"
								>
									<X className="size-4" />
								</button>
							</div>
							{attachment.error ? (
								<p className="mt-1 text-xs text-destructive">{attachment.error}</p>
							) : (
								<div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
									<div
										className="h-full rounded-full bg-neon-cyan transition-all"
										style={{ width: `${attachment.progress}%` }}
									/>
								</div>
							)}
						</div>
						{attachment.mediaID && <Check className="size-4 text-neon-green" />}
					</div>
				)}
				<div className="relative rounded-xl border border-input bg-secondary/20 transition focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/15">
					<Textarea
						aria-label="消息内容"
						className="min-h-20 resize-none border-0 bg-transparent px-4 pb-11 pt-3 shadow-none focus-visible:ring-0"
						onChange={(event) => setContent(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								void sendMessage();
							}
						}}
						placeholder="写点什么… Enter 发送，Shift+Enter 换行"
						value={content}
					/>
					<div className="absolute inset-x-3 bottom-2 flex items-center justify-between">
						<div className="flex items-center gap-1">
							<input
								accept="image/jpeg,image/png,image/webp,image/gif"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) void chooseImage(file);
									event.target.value = "";
								}}
								ref={inputRef}
								type="file"
							/>
							<Button
								aria-label="添加图片"
								onClick={() => inputRef.current?.click()}
								size="icon-sm"
								variant="ghost"
							>
								<Paperclip className="size-4" />
							</Button>
							<span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
								JPEG · PNG · WEBP · GIF / 10MB
							</span>
						</div>
						<Button
							aria-label="发送消息"
							disabled={
								send.isPending ||
								Boolean(attachment && !attachment.mediaID) ||
								(!content.trim() && !attachment?.mediaID)
							}
							onClick={() => void sendMessage()}
							size="sm"
						>
							{send.isPending ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<>
									<Send className="size-3.5" />
									发送
								</>
							)}
						</Button>
					</div>
				</div>
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
		<aside className="absolute inset-y-0 right-0 z-20 w-full border-l border-edge-hairline bg-background shadow-2xl sm:w-80 xl:static xl:z-auto xl:shadow-none">
			<header className="flex items-center justify-between border-b border-edge-hairline px-5 py-4">
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
						Inspector
					</p>
					<h3 className="mt-1 font-semibold">会话详情</h3>
				</div>
				<Button aria-label="关闭详情" onClick={onClose} size="icon-sm" variant="ghost">
					<X className="size-4" />
				</Button>
			</header>
			<div className="space-y-6 overflow-y-auto p-5">
				<div className="rounded-xl border border-edge-hairline bg-secondary/20 p-4">
					<div className="mb-3 flex items-center gap-3">
						<Avatar user={conversation.owner} className="size-12" />
						<div className="min-w-0">
							<p className="truncate font-semibold">
								{conversationLabel(conversation)}
							</p>
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
								{conversation.kind === "room" ? "Private room" : "Direct channel"}
							</p>
						</div>
					</div>
					{conversation.kind === "room" && isOwner && (
						<input
							aria-label="房间名称"
							className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-neon-cyan"
							onBlur={() => void saveTitle()}
							onChange={(event) => setTitle(event.target.value)}
							value={title}
						/>
					)}
				</div>
				<div>
					<div className="mb-3 flex items-center justify-between">
						<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							Members · {members.length}
						</p>
						<Users className="size-4 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						{members.map((member) => (
							<div className="flex items-center gap-3" key={member.user.id}>
								<Avatar user={member.user} className="size-8" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm">{member.user.display_name}</p>
									<p className="font-mono text-[10px] text-muted-foreground">
										@{member.user.username}
									</p>
								</div>
								{member.role === "owner" ? (
									<ShieldCheck className="size-4 text-neon-cyan" />
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
											<X className="size-4" />
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
							>
								<Plus className="size-4" />
							</Button>
						</div>
					</div>
				)}
				<NotificationSettings
					muted={currentMember?.is_muted ?? false}
					onMute={(muted) => mute.mutate({ id: conversation.id, muted })}
				/>
				<div className="space-y-2 border-t border-edge-hairline pt-4">
					<Button
						className="w-full justify-start text-destructive hover:text-destructive"
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
					>
						<LogOut className="mr-2 size-4" />
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
		<section className="rounded-xl border border-edge-hairline bg-secondary/20 p-4">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 rounded-md bg-neon-cyan/10 p-2 text-neon-cyan">
					<Bell className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium">浏览器通知</p>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						页面关闭后仍可收到新消息和房间邀请。
					</p>
					<Button
						className="mt-3 w-full justify-start"
						onClick={() => onMute(!muted)}
						size="sm"
						variant="ghost"
					>
						{muted ? (
							<BellOff className="mr-2 size-3.5" />
						) : (
							<Bell className="mr-2 size-3.5" />
						)}
						{muted ? "已静音此会话" : "静音此会话"}
					</Button>
					{push.enabled && (
						<label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
							<input
								checked={showPreview}
								onChange={(event) => {
									const next = event.target.checked;
									setShowPreview(next);
									void push.updatePreview(next);
								}}
								type="checkbox"
							/>
							显示消息摘要
						</label>
					)}
					<Button
						className="mt-3 w-full"
						disabled={push.busy || !push.enabled || !push.supported}
						onClick={() =>
							granted ? void push.disable() : void push.enable(showPreview)
						}
						size="sm"
						variant={granted ? "outline" : "default"}
					>
						{push.busy ? (
							<LoaderCircle className="size-3.5 animate-spin" />
						) : granted ? (
							"关闭浏览器通知"
						) : (
							"启用浏览器通知"
						)}
					</Button>
					{!push.supported && (
						<p className="mt-2 text-[11px] text-muted-foreground">
							当前浏览器不支持 Web Push。
						</p>
					)}
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
			className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
			role="dialog"
		>
			<button
				aria-label="关闭图片预览"
				className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
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
				className="relative z-10 max-h-[90dvh] max-w-[90vw] object-contain"
				src={media.url}
			/>
		</div>
	);
}

function Avatar({ user, className }: { user: ChatUser; className?: string }) {
	return user.avatar_url ? (
		<img
			alt={`${user.display_name} 的头像`}
			className={cn("rounded-full object-cover", className)}
			src={user.avatar_url}
		/>
	) : (
		<div
			className={cn(
				"flex items-center justify-center rounded-full bg-neon-purple/15 font-mono font-bold text-neon-purple",
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
				<div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan">
					<MessageCircle className="size-7" />
				</div>
				<p className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
					No channel selected
				</p>
				<h2 className="mt-2 text-2xl font-semibold">选择一个会话</h2>
				<p className="mt-3 text-sm leading-6 text-muted-foreground">
					从左侧打开私聊或房间。消息、图片和未读状态会在所有设备保持同步。
				</p>
			</div>
		</div>
	);
}

function ConversationEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="px-4 py-12 text-center">
			<Sparkles className="mx-auto size-5 text-neon-cyan" />
			<p className="mt-3 text-sm font-medium">还没有会话</p>
			<p className="mt-1 text-xs text-muted-foreground">按用户名发起一次私聊。</p>
			<Button className="mt-4" onClick={onCreate} size="sm" variant="outline">
				<Plus className="mr-1 size-3.5" />
				新建会话
			</Button>
		</div>
	);
}

function ConversationSkeleton() {
	return (
		<div className="space-y-3 px-2">
			{Array.from({ length: 5 }, (_, index) => (
				<div className="flex items-center gap-3 p-2" key={index}>
					<div className="size-10 animate-pulse rounded-full bg-secondary" />
					<div className="flex-1 space-y-2">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
						<div className="h-2 w-1/2 animate-pulse rounded bg-secondary" />
					</div>
				</div>
			))}
		</div>
	);
}

function MessageSkeleton() {
	return (
		<div className="space-y-6">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					className={cn("flex gap-3", index % 2 === 1 && "flex-row-reverse")}
					key={index}
				>
					<div className="size-8 animate-pulse rounded-full bg-secondary" />
					<div className="h-16 w-2/3 animate-pulse rounded-2xl bg-secondary" />
				</div>
			))}
		</div>
	);
}

function MessageEmpty() {
	return (
		<div className="rounded-xl border border-dashed border-edge-hairline px-6 py-12 text-center">
			<ImageIcon className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-3 text-sm font-medium">这是新的会话</p>
			<p className="mt-1 text-xs text-muted-foreground">发送第一条消息，建立连接。</p>
		</div>
	);
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

function formatBytes(value: number) {
	if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
	return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
