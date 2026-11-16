/**
 * 会话面板：消息流（滚动加载历史）、气泡、输入区与详情抽屉的编排。
 */

import type { PendingChatShare } from "@entities/tweet/model/share-store";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import type { RichTextInputHandle } from "@shared/ui/rich-text-input/RichTextInput";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useChatMembers, useChatMessages, useDeleteChatMessage } from "../api/queries";
import { useChatDraftField } from "../hooks/use-chat-draft";
import { useEmojiEmoteMap } from "../hooks/use-emoji-emote-map";
import { useConversationScroll } from "../hooks/useConversationScroll";
import { panelAppearanceUserIDs } from "../lib/appearance-users";
import { conversationLabel } from "../lib/conversation";
import { retryChatMessage, useChatOutbox } from "../model/chat-outbox";
import type { ChatConversation, ChatMedia, ChatMessage, ChatUser } from "../model/types";
import { ChatAppearanceProvider } from "./appearance/ChatAppearanceProvider";
import { useChatBackground } from "./appearance/useChatBackground";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationMessageSearch } from "./ConversationMessageSearch";
import { ConversationMessageViewport } from "./ConversationMessageViewport";
import { ConversationTimeline } from "./ConversationTimeline";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { RoomDetails } from "./RoomDetails";
import { TypingIndicator } from "./TypingIndicator";

export interface ConversationPanelProps {
	/** 被外观编辑遮住时暂停已读推进。 */
	active?: boolean;
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
	active = true,
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
		isError: messagesFailed,
		refetch: reloadMessages,
	} = useChatMessages(conversation.id);
	const { data: memberData } = useChatMembers(conversation.id);
	const members = memberData ?? [];
	const canManage = useHasPermission("chat:manage");
	const deleteMessage = useDeleteChatMessage();
	const imagePreview = useImagePreview();
	const [replyTarget, setReplyTarget] = useChatDraftField(conversation.id, "reply");
	const inputRef = useRef<RichTextInputHandle>(null);
	const headingRef = useRef<HTMLHeadingElement>(null);
	useLayoutEffect(() => {
		if (conversation.id) {
			headingRef.current?.focus({ preventScroll: true });
		}
	}, [conversation.id]);
	const handleMention = (user: ChatUser) => {
		if (user.id === currentUserID) {
			return;
		}
		if (!inputRef.current?.appendMention(user.id)) {
			toast.info("该用户不在当前会话的提及候选中");
		}
	};

	const qc = useQueryClient();
	const outbox = useChatOutbox((state) => state.entries);
	const serverMessages = useMemo(
		() => messagePages?.pages.flatMap((page) => page.data).reverse() ?? [],
		[messagePages?.pages],
	);
	const outgoing = useMemo(
		() =>
			outbox.filter(
				(entry) =>
					entry.request.id === conversation.id &&
					entry.message.sender.id === currentUserID,
			),
		[outbox, conversation.id, currentUserID],
	);
	const messages = useMemo(() => {
		const confirmed = new Set(
			serverMessages.map((message) => message.client_message_id).filter(Boolean),
		);
		return [
			...serverMessages,
			...outgoing
				.filter((entry) => !confirmed.has(entry.request.idempotencyKey))
				.map((entry) => entry.message),
		].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
	}, [serverMessages, outgoing]);
	const pendingByID = new Map(
		outgoing
			.filter((entry) => entry.status !== "sent")
			.map((entry) => [entry.message.id, entry]),
	);
	const scroll = useConversationScroll({
		conversationID: conversation.id,
		currentUserID,
		messages,
		active,
		showDetails,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	});
	const { messageRefs, highlightedID, setPendingFocusID, scrollToBottom, animateInIds } = scroll;

	const bubbleProps = (message: ChatMessage, isHead: boolean, lastInGroup = true) => ({
		animateIn: animateInIds.has(message.id),
		conversationKind: conversation.kind,
		currentUserID,
		emoteMap,
		highlighted: highlightedID === message.id,
		message,
		sending: pendingByID.get(message.id),
		onRetry: () => void retryChatMessage(qc, message.client_message_id ?? ""),
		messageRef: (node: HTMLElement | null) => {
			messageRefs.current[message.id] = node;
		},
		showSender: isHead,
		lastInGroup,
		showSenderName: conversation.kind === "room",
		onDelete:
			canManage && !pendingByID.has(message.id)
				? () =>
						deleteMessage.mutate({
							conversationID: conversation.id,
							messageID: message.id,
						})
				: undefined,
		onImage: (media: ChatMedia) => imagePreview.openPreview([media.url]),
		onMention: handleMention,
		onReply:
			message.type !== "system" && !message.is_deleted && !pendingByID.has(message.id)
				? () => setReplyTarget(message)
				: undefined,
		onReplyTo:
			message.reply_to && !message.reply_to.is_deleted
				? () => setPendingFocusID(message.reply_to?.id ?? null)
				: undefined,
	});

	const emoteMap = useEmojiEmoteMap();
	const background = useChatBackground(currentUserID);
	const [searchOpen, setSearchOpen] = useState(false);

	return (
		<ChatAppearanceProvider
			currentUserID={currentUserID}
			userIDs={panelAppearanceUserIDs(conversation, members, messages)}
		>
			<div className="relative flex h-full min-h-0 flex-1 flex-col">
				<ConversationHeader
					conversation={conversation}
					currentUserID={currentUserID}
					members={members}
					headingRef={headingRef}
					onBack={onBack}
					showDetails={showDetails}
					onToggleDetails={onToggleDetails}
					searchOpen={searchOpen}
					onToggleSearch={() => setSearchOpen((open) => !open)}
				/>

				<div
					className={cn(
						"relative flex min-h-0 flex-1 overflow-hidden bg-background",
						background,
					)}
				>
					<section className="flex min-h-0 min-w-0 flex-1 flex-col">
						{searchOpen && (
							<ConversationMessageSearch
								messages={messages}
								hasNextPage={hasNextPage}
								loading={isFetchingNextPage}
								onLoadMore={() => void fetchNextPage()}
								onSelect={(id) => {
									setPendingFocusID(id);
									setSearchOpen(false);
								}}
								onClose={() => setSearchOpen(false)}
							/>
						)}
						<ConversationMessageViewport
							scroll={scroll}
							empty={messages.length === 0}
							loading={{
								pending: messagesLoading,
								failed: messagesFailed,
								reload: () => void reloadMessages(),
								hasNextPage,
								fetchingNext: isFetchingNextPage,
							}}
						>
							<ConversationTimeline
								messages={messages}
								currentUserID={currentUserID}
								renderMessage={(message, head, last) => (
									<MessageBubble {...bubbleProps(message, head, last)} />
								)}
							/>
						</ConversationMessageViewport>
						<TypingIndicator conversationID={conversation.id} members={members} />
						<MessageComposer
							key={conversation.id}
							currentUser={
								members.find((member) => member.user.id === currentUserID)?.user
							}
							inputRef={inputRef}
							conversationTitle={conversationLabel(conversation, currentUserID)}
							conversationID={conversation.id}
							conversationKind={conversation.kind}
							currentUserID={currentUserID}
							onCancelReply={() => setReplyTarget(null)}
							onMessageSent={() => {
								setReplyTarget(null);
								scrollToBottom(true);
							}}
							pendingShare={pendingShare}
							replyTarget={replyTarget}
						/>
					</section>

					<RoomDetails
						open={showDetails}
						conversation={conversation}
						currentUserID={currentUserID}
						members={members}
						onClose={onToggleDetails}
					/>
				</div>
				<ImagePreview
					open={imagePreview.open}
					images={imagePreview.images}
					currentIndex={imagePreview.currentIndex}
					onClose={imagePreview.closePreview}
					onIndexChange={imagePreview.setCurrentIndex}
				/>
			</div>
		</ChatAppearanceProvider>
	);
}
