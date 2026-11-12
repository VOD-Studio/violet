import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { AggregatedReaction, CommentReactionResult } from "../model/types";
import { captureReaction, type ReactionSnapshot, restoreReaction } from "./optimistic";

/** 匹配同一回应前缀下的单条查询或包含目标评论的批量查询。 */
export function reactionQueryMatches(key: QueryKey, prefix: QueryKey, commentId: string): boolean {
	if (!prefix.every((part, index) => key[index] === part)) {
		return false;
	}
	if (key[prefix.length] === "batch") {
		const ids = key[prefix.length + 1];
		return Array.isArray(ids) && ids.includes(commentId);
	}
	return key[prefix.length] === commentId;
}

/** 定点更新目标评论，不替换其它评论或批量查询中的新增条目。 */
export function updateCommentReactionQueries(
	qc: QueryClient,
	prefix: QueryKey,
	commentId: string,
	update: (reactions: AggregatedReaction[]) => AggregatedReaction[],
) {
	for (const query of qc.getQueryCache().findAll({ queryKey: prefix })) {
		if (reactionQueryMatches(query.queryKey, prefix, commentId)) {
			updateQuery(qc, query.queryKey, prefix.length, commentId, update);
		}
	}
}

/** 只保存目标表情及其原位置，失败时保留其它回应的并发成功结果。 */
export function captureCommentReactionQueries(
	qc: QueryClient,
	prefix: QueryKey,
	commentId: string,
	emojiId: number,
): () => void {
	const snapshots = new Map<QueryKey, ReactionSnapshot>();
	for (const query of qc.getQueryCache().findAll({ queryKey: prefix })) {
		if (!reactionQueryMatches(query.queryKey, prefix, commentId)) {
			continue;
		}
		let reactions: AggregatedReaction[] | undefined;
		if (query.queryKey[prefix.length] === "batch") {
			const entries = qc.getQueryData<CommentReactionResult[]>(query.queryKey);
			reactions = entries?.find((item) => item.comment_id === commentId)?.reactions;
		} else {
			reactions = qc.getQueryData<AggregatedReaction[]>(query.queryKey);
		}
		if (reactions) {
			snapshots.set(query.queryKey, captureReaction(reactions, emojiId));
		}
	}
	return () => {
		for (const [key, previous] of snapshots) {
			updateQuery(qc, key, prefix.length, commentId, (reactions) =>
				restoreReaction(reactions, emojiId, previous),
			);
		}
	};
}

function updateQuery(
	qc: QueryClient,
	key: QueryKey,
	prefixLength: number,
	commentId: string,
	update: (reactions: AggregatedReaction[]) => AggregatedReaction[],
) {
	if (key[prefixLength] === "batch") {
		qc.setQueryData<CommentReactionResult[]>(key, (data) =>
			data?.map((item) => {
				if (item.comment_id !== commentId) {
					return item;
				}
				return { ...item, reactions: update(item.reactions ?? []) };
			}),
		);
		return;
	}
	qc.setQueryData<AggregatedReaction[]>(key, (data) => {
		if (!data) {
			return data;
		}
		return update(data);
	});
}
