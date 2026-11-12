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
	/** 尚未发送成功的消息保留禁用的添加入口，确认后不产生版面位移。 */
	disabled?: boolean;
	/** 已删除的消息没有回应入口。 */
	deleted?: boolean;
	/** 回应条与消息气泡保持同侧对齐。 */
	mine: boolean;
}

export function MessageReactions({
	conversationId,
	messageId,
	currentUserId,
	reactions,
	disabled = false,
	deleted = false,
	mine,
}: MessageReactionsProps) {
	const add = useAddChatMessageReaction(conversationId, messageId);
	const remove = useRemoveChatMessageReaction(conversationId, messageId);
	return (
		<EmojiReactions
			reactions={reactions}
			currentUserId={currentUserId}
			isLoggedIn={Boolean(currentUserId)}
			onAdd={deleted ? undefined : (emojiId) => add.mutate(emojiId)}
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
