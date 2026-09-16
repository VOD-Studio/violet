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
import { type KeyboardEvent, type Ref, useEffect, useRef, useState } from "react";
import { useSendChatMessage } from "../api/queries";
import { useMentionCandidates } from "../hooks/use-mention-candidates";
import { useChatTypingBroadcaster } from "../hooks/useChatTyping";
import type { ChatMessage, ChatUser, ConversationKind, SendMessageInput } from "../model/types";

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
	const clearPendingShare = useShareTweetStore((s) => s.clearPending);
	const { notifyTyping, notifyStopped } = useChatTypingBroadcaster(conversationID);
	const composerRef = useRef<HTMLDivElement>(null);
	const mentionCandidates = useMentionCandidates(conversationID, currentUserID, conversationKind);

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
		const text = attachments.length ? content.trim() : stripImagePlaceholders(content).trim();
		if (!pendingShare && !text && !attachments.length) return;
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
					ref={inputRef}
					autoFocus
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
					onImageUploadsChange={setImages}
					mentionCandidates={mentionCandidates}
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
							<Send className="size-4" />
						</Button>
					}
				/>
			</div>
		</div>
	);
}
