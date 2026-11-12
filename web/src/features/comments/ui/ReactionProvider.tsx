import type { AggregatedReaction } from "@entities/reaction/model/types";
import { ReactionDataProvider, useReactionData } from "@entities/reaction/ui/ReactionDataProvider";
import { type ReactNode, useMemo } from "react";
import { useBatchReactions, useCommentReactions } from "../api/queries";

export interface ReactionProviderProps {
	/** 首屏批量范围；展开后不在其中的回复自行补取。 */
	commentIds: string[];
	children: ReactNode;
}

const EMPTY_REACTIONS: AggregatedReaction[] = [];

export function ReactionProvider({ commentIds, children }: ReactionProviderProps) {
	const { data, isLoading, error, refetch } = useBatchReactions(commentIds);
	return (
		<ReactionDataProvider
			commentIds={commentIds}
			entries={data}
			isLoading={isLoading}
			error={error}
			onRetry={refetch}
		>
			{children}
		</ReactionDataProvider>
	);
}

/** 范围内的失败不转成 N+1；只有真正超出批量范围的回复启用独立查询。 */
export function useReactionsFromContext(commentId: string) {
	const context = useReactionData(commentId);
	const { data, isLoading, error, refetch } = useCommentReactions(commentId, {
		enabled: context === undefined,
	});
	return useMemo(
		() => context ?? { reactions: data ?? EMPTY_REACTIONS, isLoading, error, onRetry: refetch },
		[context, data, isLoading, error, refetch],
	);
}
