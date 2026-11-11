import {
	captureReaction,
	type ReactionSnapshot,
	restoreReaction,
} from "@entities/reaction/lib/optimistic";
import type { AggregatedReaction } from "@entities/reaction/model/types";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { BatchReactionResult } from "../model/types";
import { commentKeys } from "./keys";

export function reactionQueryMatches(key: QueryKey, commentId: string): boolean {
	if (key[0] !== "comments" || key[1] !== "reactions") {
		return false;
	}
	if (key[2] === "batch") {
		return Array.isArray(key[3]) && key[3].includes(commentId);
	}
	return key[2] === commentId;
}

export function updateCommentReactions(
	qc: QueryClient,
	commentId: string,
	update: (reactions: AggregatedReaction[]) => AggregatedReaction[],
) {
	for (const query of qc.getQueryCache().findAll({ queryKey: commentKeys.reactions() })) {
		if (!reactionQueryMatches(query.queryKey, commentId)) {
			continue;
		}
		updateQueryReactions(qc, query.queryKey, commentId, update);
	}
}

/** 每个缓存仅捕获目标回应，回滚时保留其他评论及其他表情的并发写入。 */
export function captureCommentReaction(qc: QueryClient, commentId: string, emojiId: number) {
	const snapshots = new Map<QueryKey, ReactionSnapshot>();
	for (const query of qc.getQueryCache().findAll({ queryKey: commentKeys.reactions() })) {
		if (!reactionQueryMatches(query.queryKey, commentId)) {
			continue;
		}
		let reactions: AggregatedReaction[] | undefined;
		if (query.queryKey[2] === "batch") {
			reactions = (query.state.data as BatchReactionResult[] | undefined)?.find(
				(item) => item.comment_id === commentId,
			)?.reactions;
		} else {
			reactions = query.state.data as AggregatedReaction[] | undefined;
		}
		if (reactions) {
			snapshots.set(query.queryKey, captureReaction(reactions, emojiId));
		}
	}
	return () => {
		for (const [key, previous] of snapshots) {
			updateQueryReactions(qc, key, commentId, (reactions) =>
				restoreReaction(reactions, emojiId, previous),
			);
		}
	};
}

function updateQueryReactions(
	qc: QueryClient,
	key: QueryKey,
	commentId: string,
	update: (reactions: AggregatedReaction[]) => AggregatedReaction[],
) {
	if (key[2] === "batch") {
		qc.setQueryData<BatchReactionResult[]>(key, (data) =>
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
