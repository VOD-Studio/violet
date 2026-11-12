import {
	captureCommentReactionQueries,
	reactionQueryMatches,
	updateCommentReactionQueries,
} from "@entities/reaction/lib/comment-query-cache";
import { addSelfReaction, removeSelfReaction } from "@entities/reaction/lib/optimistic";
import { useMe } from "@features/auth/api/queries";
import { findCachedEmoji } from "@features/emojis/api/cache";
import { apiDelete, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tweetKeys } from "./keys";

/** 回应与热度列表刷新完成前保持 pending，避免已提交后立即重复操作。 */
export function useAddTweetCommentReaction(tweetId: string, commentId: string) {
	const qc = useQueryClient();
	const me = useMe();
	const prefix = tweetKeys.commentReactions(tweetId);
	const filters = {
		predicate: (query: { queryKey: readonly unknown[] }) =>
			reactionQueryMatches(query.queryKey, prefix, commentId),
	};
	return useMutation({
		mutationFn: (emojiId: number) =>
			apiPost<null>(`/tweets/${tweetId}/comments/${commentId}/reactions`, {
				emoji_id: emojiId,
			}),
		onMutate: async (emojiId) => {
			const user = me.data;
			if (!user) {
				return;
			}
			await qc.cancelQueries(filters);
			const rollback = captureCommentReactionQueries(qc, prefix, commentId, emojiId);
			updateCommentReactionQueries(qc, prefix, commentId, (reactions) =>
				addSelfReaction(
					reactions,
					emojiId,
					{ id: user.id, name: user.display_name || user.username },
					findCachedEmoji(qc, emojiId),
				),
			);
			return { rollback };
		},
		onError: (_error, _emojiId, context) => {
			context?.rollback();
			toast.error("回应没有成功");
		},
		onSettled: () =>
			Promise.all([
				qc.invalidateQueries(filters),
				qc.invalidateQueries({ queryKey: tweetKeys.commentListOf(tweetId, "hot") }),
			]),
	});
}

/** 取消只影响本人回应；失败定点恢复原表情、GIF、公开名单与位置。 */
export function useRemoveTweetCommentReaction(tweetId: string, commentId: string) {
	const qc = useQueryClient();
	const me = useMe();
	const prefix = tweetKeys.commentReactions(tweetId);
	const filters = {
		predicate: (query: { queryKey: readonly unknown[] }) =>
			reactionQueryMatches(query.queryKey, prefix, commentId),
	};
	return useMutation({
		mutationFn: (emojiId: number) =>
			apiDelete<null>(`/tweets/${tweetId}/comments/${commentId}/reactions/${emojiId}`),
		onMutate: async (emojiId) => {
			const user = me.data;
			if (!user) {
				return;
			}
			await qc.cancelQueries(filters);
			const rollback = captureCommentReactionQueries(qc, prefix, commentId, emojiId);
			updateCommentReactionQueries(qc, prefix, commentId, (reactions) =>
				removeSelfReaction(reactions, emojiId, user.id),
			);
			return { rollback };
		},
		onError: (_error, _emojiId, context) => {
			context?.rollback();
			toast.error("回应没有成功");
		},
		onSettled: () =>
			Promise.all([
				qc.invalidateQueries(filters),
				qc.invalidateQueries({ queryKey: tweetKeys.commentListOf(tweetId, "hot") }),
			]),
	});
}
