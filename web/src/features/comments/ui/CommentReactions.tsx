import { useMe } from "@features/auth/api/queries";
import { EmojiReactions } from "@features/emojis/ui/EmojiReactions";
import { Spinner } from "@violet/ui";
import { useAddReaction, useRemoveReaction } from "../api/mutations";
import { useReactionsFromContext } from "./ReactionProvider";

export interface CommentReactionsProps {
	commentId: string;
	/** 访客仍可阅读回应，点击已有回应提示登录，不显示添加入口。 */
	isLoggedIn?: boolean;
}

export function CommentReactions({ commentId, isLoggedIn = false }: CommentReactionsProps) {
	const { reactions, isLoading } = useReactionsFromContext(commentId);
	const me = useMe({ enabled: isLoggedIn });
	const add = useAddReaction(commentId);
	const remove = useRemoveReaction(commentId);
	if (isLoading) {
		return <Spinner />;
	}
	return (
		<EmojiReactions
			reactions={reactions}
			currentUserId={me.data?.id}
			isLoggedIn={isLoggedIn}
			onAdd={(emojiId) => add.mutate({ emoji_id: emojiId })}
			onRemove={(emojiId) => remove.mutate(emojiId)}
			disabled={add.isPending || remove.isPending}
		/>
	);
}
