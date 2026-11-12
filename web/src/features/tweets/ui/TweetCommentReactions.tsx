import { ReactionDataProvider, useReactionData } from "@entities/reaction/ui/ReactionDataProvider";
import { useMe } from "@features/auth/api/queries";
import { EmojiReactions } from "@features/emojis/ui/EmojiReactions";
import { Spinner } from "@violet/ui";
import type { ReactNode } from "react";
import {
	useAddTweetCommentReaction,
	useRemoveTweetCommentReaction,
} from "../api/comment-reaction-mutations";
import {
	useBatchTweetCommentReactions,
	useTweetCommentReactions,
} from "../api/comment-reaction-queries";

/** 当前已加载评论的批量回应查询范围。 */
export interface TweetCommentReactionProviderProps {
	tweetId: string;
	commentIds: readonly string[];
	children: ReactNode;
}

/** 已加载列表共享一个批量请求；动态新增且不在批量范围内的评论才补单条。 */
export function TweetCommentReactionProvider({
	tweetId,
	commentIds,
	children,
}: TweetCommentReactionProviderProps) {
	const query = useBatchTweetCommentReactions(tweetId, commentIds);
	return (
		<ReactionDataProvider
			commentIds={commentIds}
			entries={query.data}
			isLoading={query.isLoading}
			error={query.error}
			onRetry={query.refetch}
		>
			{children}
		</ReactionDataProvider>
	);
}

/** 访客可读回应与公开名单，但不能添加或取消。 */
export interface TweetCommentReactionsProps {
	tweetId: string;
	commentId: string;
	isLoggedIn: boolean;
}

export function TweetCommentReactions({
	tweetId,
	commentId,
	isLoggedIn,
}: TweetCommentReactionsProps) {
	const shared = useReactionData(commentId);
	const individual = useTweetCommentReactions(tweetId, commentId, shared === undefined);
	const data = shared ?? {
		reactions: individual.data ?? [],
		isLoading: individual.isLoading,
		error: individual.error,
		onRetry: individual.refetch,
	};
	const me = useMe({ enabled: isLoggedIn });
	const add = useAddTweetCommentReaction(tweetId, commentId);
	const remove = useRemoveTweetCommentReaction(tweetId, commentId);
	if (data.isLoading) {
		return <Spinner />;
	}
	if (data.error && data.reactions.length === 0) {
		return (
			<div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
				回应加载失败
				{data.onRetry && (
					<button
						type="button"
						onClick={() => data.onRetry?.()}
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
			reactions={data.reactions}
			currentUserId={me.data?.id}
			isLoggedIn={isLoggedIn}
			onAdd={(emojiId) => add.mutate(emojiId)}
			onRemove={(emojiId) => remove.mutate(emojiId)}
			disabled={add.isPending || remove.isPending}
		/>
	);
}
