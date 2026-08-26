/**
 * 消息输入区：回复/推文分享 banner 与富文本 composer，Enter 发送。
 */
import {
	splitRichTextByImages,
	stripImagePlaceholders,
	stripPlaceholdersForPreview,
} from "@features/comments/hooks/use-rich-text-input";
import { type PictureInput, RichCommentInput } from "@features/comments/ui/RichCommentInput";
import { type PendingChatShare, useShareTweetStore } from "@shared/api/share-tweet-store";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { LoaderCircle, MessageSquareQuote, Reply, Send, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSendChatMessage } from "../api/queries";
import { useChatTypingBroadcaster } from "../hooks/useChatTyping";
import type { ChatMessage } from "../model/types";

export interface MessageComposerProps {
	conversationID: string;
	/** 落定到当前会话的待发分享；非空时优先展示分享 banner 并接管发送逻辑。 */
	pendingShare: PendingChatShare | null;
	replyTarget: ChatMessage | null;
	onCancelReply: () => void;
	onMessageSent?: () => void;
}

export function MessageComposer({
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
		// 尚未发送成功的图片（排除重试时已成功发送过的）。
		const pendingImages = images.filter(
			(img): img is PictureInput & { id: string } =>
				!!img.id && !sentImageIDsRef.current.has(img.id),
		);
		const pendingByID = new Map(pendingImages.map((img) => [img.id, img]));
		// 保留 ![img:id] 占位符位置按图切分：每条图片消息携带输入流中环绕自身的文字，
		// 渲染端把占位符还原为内联图片，发出消息即与输入框一致的图文环绕。
		const imageSegments = splitRichTextByImages(content).filter(
			(segment): segment is { imageId: string; text: string } =>
				segment.imageId !== null && pendingByID.has(segment.imageId),
		);
		try {
			// 当前消息模型按单条消息保存图片；引用只附着到本轮首条实际发送的消息。
			for (const segment of imageSegments) {
				const img = pendingByID.get(segment.imageId) as PictureInput & { id: string };
				const attachReply = Boolean(replyToID && !replyAttachedRef.current);
				const segmentText = segment.text.trim();
				const hasText = stripImagePlaceholders(segmentText).length > 0;
				await send.mutateAsync({
					id: conversationID,
					input: {
						type: "image",
						media_id: img.id,
						...(hasText ? { content: segmentText } : {}),
						...(attachReply && replyToID ? { reply_to_id: replyToID } : {}),
					},
					idempotencyKey: crypto.randomUUID(),
				});
				sentImageIDsRef.current.add(img.id);
				if (attachReply) replyAttachedRef.current = true;
			}

			if (imageSegments.length === 0) {
				const trimmedContent = stripImagePlaceholders(content).trim();
				if (trimmedContent) {
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
