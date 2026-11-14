import { toEmojiToken } from "@entities/emoji/model/token";
import { type PendingChatShare, useShareTweetStore } from "@entities/tweet/model/share-store";
import { useMyCustomEmojis } from "@features/customemoji/api/queries";
import type { ImageUploadReference } from "@shared/lib/image-upload-task";
import type { RichTextInputHandle } from "@shared/ui/rich-text-input/RichTextInput";
import {
	extractImageIds,
	stripImagePlaceholders,
} from "@shared/ui/rich-text-input/use-rich-text-input";
import type { MentionCandidate } from "@violet/ui";
import {
	type KeyboardEvent,
	type Ref,
	type RefCallback,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useSendChatMessage } from "../api/queries";
import type { ChatMessage, ChatUser, ConversationKind, SendMessageInput } from "../model/types";
import { useChatDraftField } from "./use-chat-draft";
import { type UseComposerCommandsReturn, useComposerCommands } from "./use-composer-commands";
import { useMentionCandidates } from "./use-mention-candidates";
import { useChatTypingBroadcaster } from "./useChatTyping";

/** 消息草稿、回复和分享的会话范围与提交回调。 */
export interface UseMessageComposerOptions {
	/** 接收会话内点击用户名触发的提及。 */
	inputRef?: Ref<RichTextInputHandle>;
	conversationID: string;
	/** 仅房间提供全体提及候选。 */
	conversationKind?: ConversationKind;
	currentUserID: string;
	currentUser?: ChatUser;
	pendingShare: PendingChatShare | null;
	replyTarget: ChatMessage | null;
	onCancelReply: () => void;
	onMessageSent?: () => void;
}

/** 输入区渲染与操作所需的草稿、上传任务及命令控制器。 */
export interface UseMessageComposerReturn {
	composerRef: RefObject<HTMLDivElement | null>;
	editorRef: RefCallback<RichTextInputHandle>;
	content: string;
	images: ImageUploadReference[];
	resetNonce: number;
	canSend: boolean;
	mentionCandidates: MentionCandidate[];
	commands: UseComposerCommandsReturn;
	onContentChange: (value: string) => void;
	onImagesChange: (images: ImageUploadReference[]) => void;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	sendMessage: () => void;
	clearPendingShare: () => void;
}

/** 组合草稿、输入状态和命令寻址，提交时移交上传任务及乐观快照。 */
export function useMessageComposer({
	inputRef,
	conversationID,
	conversationKind = "direct",
	currentUserID,
	currentUser,
	pendingShare,
	replyTarget,
	onCancelReply,
	onMessageSent,
}: UseMessageComposerOptions): UseMessageComposerReturn {
	const [content, setContent] = useChatDraftField(conversationID, "content");
	const [images, setImages] = useChatDraftField(conversationID, "images");
	const [resetNonce, setResetNonce] = useState(0);
	const submittedRef = useRef(false);
	const richInputRef = useRef<RichTextInputHandle | null>(null);
	const composerRef = useRef<HTMLDivElement>(null);
	const editorRef = useCallback(
		(handle: RichTextInputHandle | null) => {
			richInputRef.current = handle;
			if (typeof inputRef === "function") {
				inputRef(handle);
			} else if (inputRef) {
				inputRef.current = handle;
			}
		},
		[inputRef],
	);
	const commands = useComposerCommands({
		conversationID,
		conversationKind,
		inputRef: richInputRef,
	});
	const clearPendingShare = useShareTweetStore((state) => state.clearPending);
	const { notifyTyping, notifyStopped } = useChatTypingBroadcaster(conversationID);
	const mentionCandidates = useMentionCandidates(conversationID, currentUserID, conversationKind);
	const send = useSendChatMessage();
	const { data: customEmojis } = useMyCustomEmojis(true);

	useEffect(() => {
		if (content.trim()) {
			notifyTyping();
		} else {
			notifyStopped();
		}
	}, [content, notifyTyping, notifyStopped]);
	useEffect(() => {
		if (replyTarget) {
			richInputRef.current?.focus();
		}
	}, [replyTarget]);
	useEffect(() => {
		if (!content && !pendingShare) {
			submittedRef.current = false;
		}
	}, [content, pendingShare]);

	const sendMessage = () => {
		if (submittedRef.current) {
			return;
		}
		const ids = new Set(extractImageIds(content));
		const attachments = images.filter((image) => ids.has(image.id));
		const text = (
			attachments.length ? content.trim() : stripImagePlaceholders(content).trim()
		).replaceAll("\u00a0", " ");
		if (!pendingShare && !text && !attachments.length) {
			return;
		}
		const addressedText = pendingShare ? text : commands.resolveTarget(text);
		if (addressedText === null) {
			return;
		}
		const input: SendMessageInput = pendingShare
			? {
					type: "tweet_share",
					content: addressedText,
					shared_tweet_id: pendingShare.tweet.id,
				}
			: {
					type: attachments.length ? "image" : "text",
					content: addressedText,
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
						.filter((emoji) => addressedText.includes(toEmojiToken(emoji)))
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
								? [{ url: pendingShare.tweet.imageUrl, width: null, height: null }]
								: [],
						}
					: undefined,
			},
		});
		setContent("");
		commands.clear();
		setImages([]);
		setResetNonce((nonce) => nonce + 1);
		if (pendingShare) {
			clearPendingShare();
		}
		notifyStopped();
		onCancelReply();
		onMessageSent?.();
		richInputRef.current?.focus();
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape" || !event.currentTarget.contains(event.target as Node)) {
			return;
		}
		if (commands.dismissActiveMenu()) {
			event.preventDefault();
			richInputRef.current?.focus();
		} else if (pendingShare) {
			event.preventDefault();
			clearPendingShare();
		} else if (replyTarget) {
			event.preventDefault();
			onCancelReply();
		}
	};
	return {
		composerRef,
		editorRef,
		content,
		images,
		resetNonce,
		canSend: Boolean(pendingShare || content.trim() || images.length),
		mentionCandidates,
		commands,
		onContentChange(value) {
			setContent(value);
			commands.onDraftChange(value);
		},
		onImagesChange: setImages,
		onKeyDown,
		sendMessage,
		clearPendingShare,
	};
}
