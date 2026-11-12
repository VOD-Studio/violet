import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { AggregatedReaction, CommentReactionResult } from "../model/types";

export interface ReactionData {
	reactions: AggregatedReaction[];
	isLoading: boolean;
	error?: unknown;
	onRetry?: () => void;
}

interface ReactionDataProviderProps {
	commentIds: readonly string[];
	entries: readonly CommentReactionResult[] | undefined;
	isLoading: boolean;
	error?: unknown;
	onRetry?: () => void;
	children: ReactNode;
}

const EMPTY_REACTIONS: AggregatedReaction[] = [];
const LOADING_REACTIONS: ReactionData = { reactions: EMPTY_REACTIONS, isLoading: true };
const ReactionContext = createContext<ReadonlyMap<string, ReactionData> | null>(null);

/** 范围内共享结果或错误；范围外的回复才由各 feature 启用单条查询。 */
export function ReactionDataProvider({
	commentIds,
	entries,
	isLoading,
	error,
	onRetry,
	children,
}: ReactionDataProviderProps) {
	const byId = useMemo(() => {
		const result = new Map<string, ReactionData>();
		for (const id of commentIds) {
			result.set(id, LOADING_REACTIONS);
		}
		if (entries) {
			for (const entry of entries) {
				if (result.has(entry.comment_id)) {
					result.set(entry.comment_id, {
						reactions: entry.reactions ?? EMPTY_REACTIONS,
						isLoading: false,
					});
				}
			}
		}
		if (!isLoading) {
			let missingError: Error | undefined;
			for (const [id, data] of result) {
				if (data !== LOADING_REACTIONS) {
					continue;
				}
				if (!error) {
					missingError ??= new Error("回应数据不完整，请重试");
				}
				result.set(id, {
					reactions: EMPTY_REACTIONS,
					isLoading: false,
					error: error ?? missingError,
					onRetry,
				});
			}
		}
		return result;
	}, [commentIds, entries, isLoading, error, onRetry]);
	return <ReactionContext.Provider value={byId}>{children}</ReactionContext.Provider>;
}

/** undefined 只表示不在批量范围内；失败或缺项仍属于范围内，不触发逐条补取。 */
export function useReactionData(commentId: string): ReactionData | undefined {
	return useContext(ReactionContext)?.get(commentId);
}
