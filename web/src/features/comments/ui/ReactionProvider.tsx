/**
 * ReactionProvider - 评论反应上下文
 *
 * 为 CommentList 下的所有 CommentItem 提供统一的反应数据源：
 * - 首屏评论批量查询（避免 N+1）
 * - 不在批量范围内的评论（展开回复）降级为单条查询
 * - 加载态统一，避免批量查询期间各 ReactionBar 独立请求
 */
import { useCommentReactions } from "@features/comments/api/queries";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useBatchReactions } from "../api/queries";
import type { Reaction } from "../model/types";

interface ReactionContextValue {
    /** 评论 ID -> 反应列表 的映射 */
    map: Map<string, Reaction[]>;
    /** 批量查询是否仍在加载 */
    isLoading: boolean;
}

const ReactionContext = createContext<ReactionContextValue | null>(null);

export interface ReactionProviderProps {
    /** 需要批量查询反应的评论 ID 列表 */
    commentIds: string[];
    /** 子节点 */
    children: ReactNode;
}

/** ReactionProvider - 批量加载评论反应并提供上下文 */
export function ReactionProvider({ commentIds, children }: ReactionProviderProps) {
    const { data, isLoading } = useBatchReactions(commentIds);

    const map = useMemo(() => {
        const m = new Map<string, Reaction[]>();
        if (data) {
            for (const item of data) {
                // 后端 nil slice 可能序列化为 null，统一归为空数组
                m.set(item.comment_id, item.reactions ?? []);
            }
        }
        return m;
    }, [data]);

    const value = useMemo(() => ({ map, isLoading }), [map, isLoading]);

    return <ReactionContext.Provider value={value}>{children}</ReactionContext.Provider>;
}

/**
 * useReactionsFromContext - 从上下文读取评论反应
 *
 * 规则：
 * - 无上下文时：自行单条查询
 * - 有上下文且批量查询加载中：等待批量结果，不触发单条查询
 * - 有上下文且批量查询完成：若 map 包含该评论 ID 则使用批量结果；否则降级单条查询（动态加载的回复）
 */
export function useReactionsFromContext(commentId: string): {
    reactions: Reaction[];
    isLoading: boolean;
} {
    const ctx = useContext(ReactionContext);

    const shouldFetchIndividual = ctx !== null && !ctx.isLoading && !ctx.map.has(commentId);
    const { data: individual, isLoading: individualLoading } = useCommentReactions(commentId, {
        enabled: shouldFetchIndividual,
    });

    return useMemo(() => {
        if (!ctx) {
            return { reactions: individual ?? [], isLoading: individualLoading };
        }
        if (ctx.map.has(commentId)) {
            return { reactions: ctx.map.get(commentId) ?? [], isLoading: ctx.isLoading };
        }
        return { reactions: individual ?? [], isLoading: ctx.isLoading || individualLoading };
    }, [ctx, commentId, individual, individualLoading]);
}
