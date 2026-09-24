/**
 * 消息输入区：回复/推文分享 banner 与富文本 composer，Enter 发送。
 */
import { toEmojiToken } from "@entities/emoji/model/token";
import {
	extractImageIds,
	stripImagePlaceholders,
	stripPlaceholdersForPreview,
} from "@features/comments/hooks/use-rich-text-input";
import {
	RichCommentInput,
	type RichCommentInputHandle,
} from "@features/comments/ui/RichCommentInput";
import { useMyCustomEmojis } from "@features/customemoji/api/queries";
import { type PendingChatShare, useShareTweetStore } from "@shared/api/share-tweet-store";
import type { ImageUploadReference } from "@shared/lib/image-upload-task";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { MessageSquareQuote, Reply, Send, X } from "lucide-react";
import {
	type KeyboardEvent,
	type Ref,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useBotCommands, useChatMembers, useSendChatMessage } from "../api/queries";
import { useMentionCandidates } from "../hooks/use-mention-candidates";
import { useChatTypingBroadcaster } from "../hooks/useChatTyping";
import type { ChatMessage, ChatUser, ConversationKind, SendMessageInput } from "../model/types";
import {
	type BotCommandChoice,
	BotCommandMenu,
	BotTargetMenu,
	botCommandListboxId,
	botCommandOptionId,
	botTargetListboxId,
	botTargetOptionId,
} from "./BotCommandMenu";

export interface MessageComposerProps {
	/** 接收会话内点击用户名触发的提及。 */
	inputRef?: Ref<RichCommentInputHandle>;
	conversationID: string;
	/** 仅房间提供全体提及候选。 */
	conversationKind?: ConversationKind;
	/** 当前用户 ID，用于把自己从提及候选里剔除 */
	currentUserID: string;
	currentUser?: ChatUser;
	/** 落定到当前会话的待发分享；非空时优先展示分享 banner 并接管发送逻辑。 */
	pendingShare: PendingChatShare | null;
	replyTarget: ChatMessage | null;
	onCancelReply: () => void;
	onMessageSent?: () => void;
}

export function MessageComposer({
	inputRef,
	conversationID,
	conversationKind = "direct",
	currentUserID,
	currentUser,
	pendingShare,
	replyTarget,
	onCancelReply,
	onMessageSent,
}: MessageComposerProps) {
	const [content, setContent] = useState("");
	const [images, setImages] = useState<ImageUploadReference[]>([]);
	const submittedRef = useRef(false);
	const [resetNonce, setResetNonce] = useState(0);
	const [slashQuery, setSlashQuery] = useState<string | null>(null);
	const [activeCommandIndex, setActiveCommandIndex] = useState(0);
	const [activeTargetIndex, setActiveTargetIndex] = useState(0);
	const [needsTarget, setNeedsTarget] = useState(false);
	const richInputRef = useRef<RichCommentInputHandle | null>(null);
	const setRichInputRef = useCallback(
		(handle: RichCommentInputHandle | null) => {
			richInputRef.current = handle;
			if (typeof inputRef === "function") inputRef(handle);
			else if (inputRef) inputRef.current = handle;
		},
		[inputRef],
	);
	const clearPendingShare = useShareTweetStore((s) => s.clearPending);
	const { notifyTyping, notifyStopped } = useChatTypingBroadcaster(conversationID);
	const composerRef = useRef<HTMLDivElement>(null);
	const mentionCandidates = useMentionCandidates(conversationID, currentUserID, conversationKind);
	const { data: members } = useChatMembers(conversationID);
	const { data: catalogs, refetch: refetchBotCommands } = useBotCommands(
		conversationID,
		slashQuery !== null,
	);
	const roomBots = useMemo(() => {
		const enabledIDs = catalogs ? new Set(catalogs.bots.map((bot) => bot.bot_user_id)) : null;
		return (members ?? [])
			.map((member) => member.user)
			.filter((user) => user.is_bot && (!enabledIDs || enabledIDs.has(user.id)));
	}, [members, catalogs]);
	const commandChoices = useMemo(() => {
		if (slashQuery === null) return [];
		const query = slashQuery.toLocaleLowerCase().trimStart();
		return (catalogs?.bots ?? []).flatMap((bot) =>
			(bot.commands ?? [])
				.filter((command) => {
					const path = command.path.join(" ").toLocaleLowerCase();
					return (
						!query ||
						path.startsWith(query) ||
						command.description.toLocaleLowerCase().includes(query)
					);
				})
				.map((command): BotCommandChoice => ({ bot, command })),
		);
	}, [catalogs, slashQuery]);
	const selectedCommandIndex = Math.min(
		activeCommandIndex,
		Math.max(commandChoices.length - 1, 0),
	);
	const selectedTargetIndex = Math.min(activeTargetIndex, Math.max(roomBots.length - 1, 0));

	const slashOpen = slashQuery !== null;
	useEffect(() => {
		if (slashOpen) void refetchBotCommands();
	}, [slashOpen, refetchBotCommands]);

	const selectCommand = (choice: BotCommandChoice) => {
		const mention =
			conversationKind === "room"
				? {
						id: choice.bot.bot_user_id,
						username: choice.bot.username,
						displayName: choice.bot.name,
					}
				: undefined;
		richInputRef.current?.replaceSlashQuery(`/${choice.command.path.join(" ")}\u00a0`, mention);
		setSlashQuery(null);
		setNeedsTarget(false);
	};
	const selectTarget = (bot: ChatUser) => {
		richInputRef.current?.prependMention(
			bot.id,
			bot.username,
			bot.display_name || bot.username,
		);
		setNeedsTarget(false);
		setSlashQuery(null);
	};
	const handleSlashKeyDown = (event: KeyboardEvent): boolean => {
		if (event.nativeEvent.isComposing) return false;
		if (needsTarget && roomBots.length > 0) {
			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					setActiveTargetIndex((index) => (index + 1) % roomBots.length);
					return true;
				case "ArrowUp":
					event.preventDefault();
					setActiveTargetIndex(
						(index) => (index - 1 + roomBots.length) % roomBots.length,
					);
					return true;
				case "Enter":
				case "Tab":
					if (event.key === "Enter" && event.shiftKey) return false;
					event.preventDefault();
					selectTarget(roomBots[selectedTargetIndex]);
					return true;
				case "Escape":
					event.preventDefault();
					event.stopPropagation();
					setNeedsTarget(false);
					return true;
			}
		}
		if (slashQuery === null || commandChoices.length === 0) return false;
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setActiveCommandIndex((index) => (index + 1) % commandChoices.length);
				return true;
			case "ArrowUp":
				event.preventDefault();
				setActiveCommandIndex(
					(index) => (index - 1 + commandChoices.length) % commandChoices.length,
				);
				return true;
			case "Enter":
			case "Tab":
				if (event.key === "Enter" && event.shiftKey) return false;
				event.preventDefault();
				selectCommand(commandChoices[selectedCommandIndex]);
				return true;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				setSlashQuery(null);
				return true;
			default:
				return false;
		}
	};

	useEffect(() => {
		if (content.trim()) {
			notifyTyping();
		} else {
			notifyStopped();
		}
	}, [content, notifyTyping, notifyStopped]);

	useEffect(() => {
		if (!replyTarget) return;
		composerRef.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
	}, [replyTarget]);

	const send = useSendChatMessage();
	const { data: customEmojis } = useMyCustomEmojis(true);

	const sendMessage = () => {
		if (submittedRef.current) return;
		const ids = new Set(extractImageIds(content));
		const attachments = images.filter((image) => ids.has(image.id));
		let text = (
			attachments.length ? content.trim() : stripImagePlaceholders(content).trim()
		).replaceAll("\u00a0", " ");
		if (!pendingShare && !text && !attachments.length) return;
		if (
			!pendingShare &&
			conversationKind === "room" &&
			text.startsWith("/") &&
			!text.startsWith("//")
		) {
			if (roomBots.length === 1) {
				text = `@(${roomBots[0].username}:${roomBots[0].id}) ${text}`;
			} else if (roomBots.length > 1) {
				setActiveTargetIndex(0);
				setNeedsTarget(true);
				return;
			}
		}
		const input: SendMessageInput = pendingShare
			? { type: "tweet_share", content: text, shared_tweet_id: pendingShare.tweet.id }
			: {
					type: attachments.length ? "image" : "text",
					content: text,
					...(replyTarget ? { reply_to_id: replyTarget.id } : {}),
				};
		submittedRef.current = true;
		void send.mutateAsync({
			id: conversationID,
			input,
			idempotencyKey: crypto.randomUUID(),
			images: pendingShare ? [] : attachments,
			draft: {
				custom_emote: Object.fromEntries(
					[...(customEmojis?.owned ?? []), ...(customEmojis?.favorited ?? [])]
						.filter((emoji) => text.includes(toEmojiToken(emoji)))
						.map((emoji) => [
							toEmojiToken(emoji),
							{
								url: emoji.url,
								custom_emoji_id: emoji.custom_emoji_id,
								relation: emoji.relation,
							},
						]),
				),
				sender: currentUser ?? {
					id: currentUserID,
					username: "",
					display_name: "我",
					avatar_url: "",
				},
				reply_to:
					!pendingShare && replyTarget && replyTarget.type !== "system"
						? {
								id: replyTarget.id,
								sender: replyTarget.sender,
								type: replyTarget.type,
								content: replyTarget.content,
								media: replyTarget.media?.[0],
								is_deleted: replyTarget.is_deleted,
							}
						: undefined,
				shared_tweet: pendingShare
					? {
							id: pendingShare.tweet.id,
							content: pendingShare.tweet.content,
							is_deleted: false,
							author: {
								id: "",
								username: pendingShare.tweet.authorUsername,
								display_name: pendingShare.tweet.authorUsername,
								avatar_url: "",
							},
							images: pendingShare.tweet.imageUrl
								? [pendingShare.tweet.imageUrl]
								: [],
						}
					: undefined,
			},
		});
		setContent("");
		setSlashQuery(null);
		setNeedsTarget(false);
		setImages([]);
		setResetNonce((n) => n + 1);
		if (pendingShare) clearPendingShare();
		notifyStopped();
		onCancelReply();
		onMessageSent?.();
		composerRef.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
	};

	useEffect(() => {
		if (!content && !pendingShare) submittedRef.current = false;
	}, [content, pendingShare]);
	const canSend = Boolean(pendingShare || content.trim() || images.length);

	return (
		<div
			ref={composerRef}
			onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
				if (event.key === "Escape" && needsTarget) {
					event.preventDefault();
					setNeedsTarget(false);
				} else if (event.key === "Escape" && pendingShare) {
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
										? stripPlaceholdersForPreview(
												replyTarget.content ?? "",
											).trim() || "图片消息"
										: stripPlaceholdersForPreview(
												replyTarget.content ?? "",
											).trim() || "文本消息"}
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
					ref={setRichInputRef}
					autoFocus
					value={content}
					onChange={(value) => {
						setContent(value);
						if (!value.trim().startsWith("/")) setNeedsTarget(false);
					}}
					onSubmit={sendMessage}
					onSlashQueryChange={(query) => {
						setSlashQuery(query);
						setActiveCommandIndex(0);
					}}
					onSlashKeyDown={handleSlashKeyDown}
					slashSuggestions={
						needsTarget ? (
							<BotTargetMenu
								bots={roomBots}
								activeIndex={selectedTargetIndex}
								onActiveIndexChange={setActiveTargetIndex}
								onSelect={selectTarget}
							/>
						) : slashQuery !== null && commandChoices.length > 0 ? (
							<BotCommandMenu
								choices={commandChoices}
								activeIndex={selectedCommandIndex}
								onActiveIndexChange={setActiveCommandIndex}
								onSelect={selectCommand}
							/>
						) : undefined
					}
					slashListboxId={needsTarget ? botTargetListboxId : botCommandListboxId}
					slashActiveOptionId={
						needsTarget
							? botTargetOptionId(selectedTargetIndex)
							: botCommandOptionId(selectedCommandIndex)
					}
					editorLabel="消息内容"
					enableEmoji={true}
					enableImage={!pendingShare}
					inlineImages={!pendingShare}
					uploadPurpose="chat"
					submitOnEnter={true}
					compact={true}
					layout="inline"
					placeholder="输入消息…"
					resetNonce={resetNonce}
					onImageUploadsChange={setImages}
					mentionCandidates={mentionCandidates}
					className="rounded-2xl border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
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
							<Send className="size-4" />
						</Button>
					}
				/>
			</div>
		</div>
	);
}
