import { iconProps, Tag } from "@violet/ui";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChatAppearance } from "../hooks/useChatAppearance";
import { imageBubbleContent } from "../lib/conversation";
import type { OutgoingMessage } from "../model/chat-outbox";
import type { ChatMedia, ChatMessage, ChatUser, ConversationKind } from "../model/types";
import { AppearanceBadgeStrip } from "./appearance/AppearanceBadgeStrip";
import { BotReplyCard } from "./BotReplyCard";
import { BubbleShell, BubbleTimestamp } from "./bubble-shell";
import { ChatMessageContent } from "./ChatMessageContent";
import { MessageActions } from "./MessageActions";
import { MessageDeliveryStatus } from "./MessageDeliveryStatus";
import { MessageEditComposer } from "./MessageEditComposer";
import { MessageReactions } from "./MessageReactions";
import { MessageReadReceipt } from "./MessageReadReceipt";
import { MessageReplyPreview } from "./MessageReplyPreview";
import { MusicShareCard } from "./MusicShareCard";
import { TweetShareCard } from "./TweetShareCard";

/** 正文、引用与发送状态组成一条消息，回应保留在气泡下方。 */
export interface MessageBubbleProps {
	message: ChatMessage;
	sending?: Pick<OutgoingMessage, "status" | "progress" | "error">;
	onRetry?: () => void;
	currentUserID: string;
	/** 会话形态决定已读回执是否提供成员名单。 */
	conversationKind: ConversationKind;
	highlighted: boolean;
	emoteMap: Record<string, { url: string; gif_url?: string; size?: number }>;
	showSender: boolean;
	showSenderName: boolean;
	lastInGroup?: boolean;
	messageRef: (node: HTMLElement | null) => void;
	onDelete?: () => void;
	onImage: (media: ChatMedia) => void;
	/** 点击发送者或已读成员名字时追加提及。 */
	onMention?: (user: ChatUser) => void;
	onReply?: () => void;
	onReplyTo?: () => void;
	animateIn: boolean;
}

/** 同组消息共用头像；时间与回执随气泡呈现，长按可打开操作。 */
export function MessageBubble({
	animateIn,
	message,
	sending,
	onRetry,
	currentUserID,
	conversationKind,
	emoteMap,
	highlighted,
	showSender,
	showSenderName,
	lastInGroup = true,
	messageRef,
	onDelete,
	onImage,
	onMention,
	onReply,
	onReplyTo,
}: MessageBubbleProps) {
	const appearance = useChatAppearance(message.sender.id);
	const mine = message.sender.id === currentUserID;
	const isBotReply = message.sender.is_bot && message.type === "text";
	const [editing, setEditing] = useState(false);
	const mergedEmote = useMemo(
		() => (message.custom_emote ? { ...emoteMap, ...message.custom_emote } : emoteMap),
		[emoteMap, message.custom_emote],
	);
	const [touchActionsVisible, setTouchActionsVisible] = useState(false);
	const longPressTimer = useRef<number | null>(null);
	const clearLongPress = () => {
		if (longPressTimer.current === null) {
			return;
		}
		window.clearTimeout(longPressTimer.current);
		longPressTimer.current = null;
	};
	const startLongPress = (event: PointerEvent) => {
		if (event.pointerType !== "touch") {
			return;
		}
		clearLongPress();
		longPressTimer.current = window.setTimeout(() => {
			setTouchActionsVisible(true);
			longPressTimer.current = null;
		}, 500);
	};
	useEffect(() => () => window.clearTimeout(longPressTimer.current ?? undefined), []);

	if (message.type === "system") {
		return (
			<div ref={messageRef} className="my-2 flex justify-center">
				<p className="px-3 py-1 text-center text-xs text-muted-foreground">
					{message.content}
				</p>
			</div>
		);
	}

	const sender =
		showSender && !mine && showSenderName && !isBotReply ? (
			<div className="mb-0.5 flex items-center gap-1.5 text-[13px]">
				<button
					aria-label={`提及 ${message.sender.display_name}`}
					className="rounded text-left font-semibold text-selected-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
					disabled={!onMention}
					onClick={() => onMention?.(message.sender)}
					type="button"
				>
					{message.sender.display_name}
				</button>
				{message.sender.is_bot && (
					<Tag size="sm" tone="accent">
						角色
					</Tag>
				)}
				<AppearanceBadgeStrip badgeIDs={appearance.badge_ids} />
			</div>
		) : undefined;
	const reply = message.reply_to ? (
		<MessageReplyPreview reference={message.reply_to} onClick={onReplyTo} />
	) : undefined;
	const content = (
		<ChatMessageContent
			content={
				message.type === "image" ? imageBubbleContent(message) : (message.content ?? "")
			}
			emote={mergedEmote}
			mentions={message.mentions}
			viewerID={currentUserID}
			inlineMedia={message.type === "image" ? message.media : undefined}
			onImage={onImage}
		/>
	);
	const hasReactions = Boolean(message.reactions?.length);
	const reactions = (
		<MessageReactions
			conversationId={message.conversation_id}
			messageId={message.id}
			currentUserId={currentUserID}
			disabled={Boolean(sending) || message.is_deleted}
			deleted={message.is_deleted}
			reactions={message.reactions ?? []}
			mine={mine}
		/>
	);
	const metadata = !editing && (
		<div data-chat-message-meta className="mt-1 flex min-h-4 items-center justify-end gap-1">
			<BubbleTimestamp
				time={message.created_at}
				editedAt={isBotReply ? undefined : message.edited_at}
			/>
			{mine && !sending && !message.is_deleted && (
				<MessageReadReceipt
					conversationKind={conversationKind}
					message={message}
					onMention={onMention}
				/>
			)}
			{sending && <MessageDeliveryStatus sending={sending} onRetry={onRetry} />}
		</div>
	);

	return (
		<motion.article
			ref={messageRef}
			data-testid={`chat-message-${message.id}`}
			initial={animateIn ? { opacity: 0 } : false}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.15 }}
			onPointerDown={startLongPress}
			onPointerLeave={clearLongPress}
			onPointerCancel={clearLongPress}
			onPointerUp={clearLongPress}
			className={cn(
				"group relative col-start-1 row-span-2 grid min-w-0 grid-rows-subgrid transition-shadow duration-300",
				!showSender && "mt-0.5",
				highlighted && "rounded-lg ring-2 ring-ring ring-offset-2 ring-offset-background",
			)}
		>
			<div className={cn("row-start-1 flex min-w-0 items-end gap-2", mine && "justify-end")}>
				{!mine && <div className="size-9 shrink-0" />}
				<div
					className={cn(
						"relative flex min-w-0 flex-col",
						mine
							? "max-w-[85%] items-end md:max-w-[75%]"
							: "max-w-[calc(100%-2.75rem)] items-start md:max-w-[80%]",
					)}
				>
					<div
						data-chat-message-body
						className={cn("relative max-w-full", isBotReply && "w-full min-w-0")}
					>
						{editing && !message.is_deleted ? (
							<MessageEditComposer
								conversationKind={conversationKind}
								currentUserID={currentUserID}
								message={message}
								onClose={() => setEditing(false)}
							/>
						) : message.is_deleted ? (
							<div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-xs italic text-muted-foreground">
								<TriangleAlert
									{...iconProps(14, "mr-1.5 inline text-destructive")}
								/>
								消息已被管理员删除
							</div>
						) : isBotReply ? (
							<BotReplyCard
								message={message}
								viewerID={currentUserID}
								emote={mergedEmote}
								onMention={onMention}
								replyPreview={reply}
							/>
						) : (
							<BubbleShell
								mine={mine}
								themeId={appearance.bubble_theme_id}
								lastInGroup={lastInGroup}
								header={sender}
							>
								{reply}
								{content}
								{message.type === "music_share" && message.music_share && (
									<div className={cn(message.content && "mt-2")}>
										<MusicShareCard song={message.music_share} />
									</div>
								)}
								{message.type === "tweet_share" && (
									<div className={cn(message.content && "mt-2")}>
										<TweetShareCard
											tweet={
												message.shared_tweet ?? {
													id: message.id,
													is_deleted: true,
												}
											}
										/>
									</div>
								)}
								{metadata}
							</BubbleShell>
						)}
						{!editing && !message.is_deleted && (
							<div
								className={cn(
									"pointer-events-none absolute bottom-full z-10 mb-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
									touchActionsVisible && "pointer-events-auto opacity-100",
									mine ? "right-0" : "left-0",
								)}
							>
								<div className="flex items-center gap-1">
									{!hasReactions && reactions}
									{!sending && (
										<MessageActions
											content={message.content}
											canCopy={message.type === "text"}
											onEdit={mine ? () => setEditing(true) : undefined}
											onReply={onReply}
											onDelete={onDelete}
										/>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			<div
				className={cn(
					"relative row-start-2 flex min-w-0 flex-col",
					mine
						? "max-w-[85%] items-end justify-self-end md:max-w-[75%]"
						: "ml-11 max-w-[calc(100%-2.75rem)] items-start md:max-w-[80%]",
				)}
			>
				{(isBotReply || message.is_deleted) && metadata}
				{hasReactions && <div className="pt-1">{reactions}</div>}
			</div>
		</motion.article>
	);
}
