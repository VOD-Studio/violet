import type { AggregatedReaction } from "@entities/reaction/model/types";
import { EmojiReactions } from "@features/emojis/ui/EmojiReactions";
import { toast } from "sonner";
import { useAddChatMessageReaction, useRemoveChatMessageReaction } from "../api/queries";

const REACTION_LIMIT_MESSAGE = "单条消息最多 3 种回应，先取消一种";

export interface MessageReactionsProps {
	conversationId: string;
	messageId: string;
	currentUserId: string;
	reactions: AggregatedReaction[];
	/** 尚未发送成功或已删除的消息不能回应。 */
	disabled?: boolean;
	/** 回应条与消息气泡保持同侧对齐。 */
	mine: boolean;
}

export function MessageReactions({
	conversationId,
	messageId,
	currentUserId,
	reactions,
	disabled = false,
	mine,
}: MessageReactionsProps) {
	const add = useAddChatMessageReaction(conversationId, messageId);
	const remove = useRemoveChatMessageReaction(conversationId, messageId);
	return (
		<EmojiReactions
			reactions={reactions}
			currentUserId={currentUserId}
			isLoggedIn={Boolean(currentUserId)}
			onAdd={disabled ? undefined : (emojiId) => add.mutate(emojiId)}
			onRemove={(emojiId) => remove.mutate(emojiId)}
			maxSelected={3}
			collapseAfter={6}
			onLimit={() => toast.info(REACTION_LIMIT_MESSAGE)}
			limitMessage={REACTION_LIMIT_MESSAGE}
			disabled={disabled || add.isPending || remove.isPending}
			className={mine ? "justify-end pt-1" : "justify-start pt-1"}
		/>
	);
}
