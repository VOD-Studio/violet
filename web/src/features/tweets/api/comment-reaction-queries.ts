import type { AggregatedReaction, CommentReactionResult } from "@entities/reaction/model/types";
import { apiGet, apiPost } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { tweetKeys } from "./keys";

const MAX_BATCH_SIZE = 100;

async function fetchCommentReactions(tweetId: string, commentIds: readonly string[]) {
	const results: CommentReactionResult[] = [];
	for (let offset = 0; offset < commentIds.length; offset += MAX_BATCH_SIZE) {
		const batch = await apiPost<CommentReactionResult[]>(
			`/tweets/${tweetId}/comments/reactions/batch`,
			{
				comment_ids: commentIds.slice(offset, offset + MAX_BATCH_SIZE),
			},
		);
		results.push(...batch);
	}
	return results;
}

export function useTweetCommentReactions(tweetId: string, commentId: string, enabled: boolean) {
	return useQuery({
		queryKey: tweetKeys.commentReactionList(tweetId, commentId),
		queryFn: () =>
			apiGet<AggregatedReaction[]>(`/tweets/${tweetId}/comments/${commentId}/reactions`),
		enabled: enabled && !!tweetId && !!commentId,
	});
}

export function useBatchTweetCommentReactions(tweetId: string, commentIds: readonly string[]) {
	const ids = useMemo(() => [...new Set(commentIds)].sort(), [commentIds]);
	return useQuery({
		queryKey: tweetKeys.commentReactionBatch(tweetId, ids),
		queryFn: () => fetchCommentReactions(tweetId, ids),
		enabled: !!tweetId && ids.length > 0,
	});
}
