import { useMe } from "@features/auth/api/queries";
import { EmojiReactions } from "@features/emojis/ui/EmojiReactions";
import { Spinner } from "@violet/ui";
import { useAddReaction, useRemoveReaction } from "../api/mutations";
import { useReactionsFromContext } from "./ReactionProvider";

export interface CommentReactionsProps {
	/** 所属文章，用于回应改变热度后的定向刷新。 */
	postId: string;
	commentId: string;
	/**
	 * 访客仍可阅读回应，点击已有回应提示登录，不显示添加入口。
	 *
	 * @default false
	 */
	isLoggedIn?: boolean;
}

export function CommentReactions({ postId, commentId, isLoggedIn = false }: CommentReactionsProps) {
	const { reactions, isLoading, error, onRetry } = useReactionsFromContext(commentId);
	const me = useMe({ enabled: isLoggedIn });
	const add = useAddReaction(commentId, postId);
	const remove = useRemoveReaction(commentId, postId);
	if (isLoading) {
		return <Spinner />;
	}
	if (error && reactions.length === 0) {
		return (
			<div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
				回应加载失败
				{onRetry && (
					<button
						type="button"
						onClick={() => onRetry()}
						className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						重试
					</button>
				)}
			</div>
		);
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
