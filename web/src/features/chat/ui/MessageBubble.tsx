/**
 * 消息气泡：正文/图片/推文分享三种形态，hover 长按操作条与 reaction 挂载点。
 */
import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { cn } from "@shared/lib/utils";
import { AlertTriangle, Check, Copy, Reply, Smile, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAddChatMessageReaction, useRemoveChatMessageReaction } from "../api/queries";
import type { ChatMedia, ChatMessage, ChatMessageReference } from "../model/types";
import { BubbleShell, BubbleTimestamp } from "./bubble-shell";
import { ChatAvatar } from "./ChatAvatar";
import { ChatMessageContent } from "./ChatMessageContent";
import { ChatReactionBar } from "./ChatReactionBar";
import { TweetShareCard } from "./TweetShareCard";

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

export function MessageBubble({
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
					"relative flex max-w-[min(70%,36rem)] flex-col",
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
								"absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
								touchActionsVisible && "opacity-100",
								mine ? "right-full mr-1.5" : "left-full ml-1.5",
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
