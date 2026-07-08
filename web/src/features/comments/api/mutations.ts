import type { Comment } from "@entities/comment/model/types";
import type { EmojiGroup } from "@entities/emoji/model/types";
import { useMe } from "@features/auth/api/queries";
import { emojiKeys } from "@features/emojis/api/keys";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    AddReaction,
    BatchReactionResult,
    CreateComment,
    Reaction,
    SendCodeBody,
} from "../model/types";
import { commentKeys } from "./keys";

/**
 * useCreateComment - 调后端 POST /posts/{postId}/comments 提交评论
 *
 * 双轨认证（PRD-0001）：
 *   - 登录态：body 仅需 body 字段，author_name/author_email/code 由后端忽略
 *   - 匿名态：body 需含 author_name/author_email/code（邮箱验证码两步流）
 *
 * 新评论默认 pending 状态，需审核后才在前台公开（登录提交者本人立即可见带「审批中」徽章）。
 *
 * 乐观更新（提交后立即显示，不等重拉）：
 *   - 顶层评论：直接 invalidate list 缓存重拉（顶层条目少，重拉开销小且数据新鲜）
 *   - 回复（parent_id 非空）：乐观追加到 useReplies 缓存（展开态立即看到），
 *     同时手动递增顶层列表里父评论的 replies_total（不触发重拉，避免批注 relocate 重算导致角标消失）
 */
export const useCreateComment = (postId: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateComment) => apiPost<Comment>(`/posts/${postId}/comments`, body),
        onSuccess: (newComment, variables) => {
            try {
                if (variables.parent_id) {
                    optimisticAppendReply(qc, variables.parent_id, newComment);
                    bumpRepliesTotalInList(qc, postId, variables.parent_id);
                    // 失效按块懒加载的批注详情查询（面板内容刷新），不影响 summary（角标稳定）
                    qc.invalidateQueries({
                        predicate: (query) => {
                            const key = query.queryKey;
                            if (key[0] !== "comments" || key[1] !== "list" || key[2] !== postId)
                                return false;
                            const q = key[3] as { block_id?: string } | undefined;
                            return !!q?.block_id;
                        },
                    });
                } else {
                    invalidateListByType(qc, postId, variables.anchor ? "annotation" : "free");
                    if (variables.anchor) {
                        qc.invalidateQueries({ queryKey: commentKeys.annotationSummary(postId) });
                    }
                }
            } catch (e) {
                console.error("乐观更新失败，降级 invalidate", e);
                invalidateListsForPost(qc, postId);
                qc.invalidateQueries({ queryKey: commentKeys.annotationSummary(postId) });
                if (variables.parent_id) {
                    qc.invalidateQueries({ queryKey: commentKeys.replies() });
                }
            }
        },
    });
};

/** bumpRepliesTotalInList 手动递增顶层列表缓存中父评论的 replies_total。
 *  用 setQueriesData 直接改缓存，不触发重拉——避免批注列表 refetch 引起 relocate 重算和角标消失。
 *  useComments 是 useQuery（非 infinite），缓存结构是 { data: Comment[], pagination }。 */
function bumpRepliesTotalInList(
    qc: ReturnType<typeof useQueryClient>,
    postId: string,
    parentCommentId: string,
) {
    qc.setQueriesData(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key[0] === "comments" && key[1] === "list" && key[2] === postId;
            },
        },
        (old: unknown) => {
            if (!old || typeof old !== "object") return old;
            const typed = old as PagedResponse<Comment>;
            if (!Array.isArray(typed.data)) return old;
            return {
                ...typed,
                data: typed.data.map((c) =>
                    c.id === parentCommentId
                        ? { ...c, replies_total: (c.replies_total ?? 0) + 1 }
                        : c,
                ),
            };
        },
    );
}

/** invalidateListsForPost 失效指定文章的所有顶层评论列表缓存（free + annotation）。
 *  仅作 catch 降级使用——正常流程不再 invalidate 列表，避免批注 relocate 重算。 */
function invalidateListsForPost(qc: ReturnType<typeof useQueryClient>, postId: string) {
    qc.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey;
            return key[0] === "comments" && key[1] === "list" && key[2] === postId;
        },
    });
}

/**
 * optimisticAppendReply 把新回复追加到 useReplies 缓存末尾。
 *
 * useReplies 是 useInfiniteQuery，缓存形如 { pages: [{data, pagination}], pageParams }。
 * 在第一页 data 末尾追加新回复——按时间正序是最新的在最末，符合 ASC 语义。
 * 如果该 commentId 没有缓存（回复区未展开），不做任何操作，下次展开会从后端拉到。
 */
function optimisticAppendReply(
    qc: ReturnType<typeof useQueryClient>,
    parentCommentId: string,
    newReply: Comment,
) {
    // useReplies 的 key 形如 ["comments","replies",commentId,{sort,limit}]
    // 遍历所有匹配该 commentId 的缓存（不同 sort/page 变体），追加新回复
    qc.setQueriesData(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key[0] === "comments" && key[1] === "replies" && key[2] === parentCommentId;
            },
        },
        (old: unknown) => {
            // 防御性类型检查：infinite query 缓存结构是 { pages: [...], pageParams: [...] }
            if (
                !old ||
                typeof old !== "object" ||
                !Array.isArray((old as { pages?: unknown[] }).pages)
            ) {
                return old;
            }
            const typed = old as { pages: PagedResponse<Comment>[]; pageParams: number[] };
            if (typed.pages.length === 0) return old;
            const newPages = [...typed.pages];
            const firstPage = newPages[0];
            if (!firstPage || !Array.isArray(firstPage.data)) return old;
            // 第一页 data 末尾追加（ASC 时是最新的在末尾）
            newPages[0] = {
                ...firstPage,
                data: [...firstPage.data, newReply],
                pagination: {
                    ...firstPage.pagination,
                    total: (firstPage.pagination?.total ?? 0) + 1,
                },
            };
            return { ...typed, pages: newPages };
        },
    );
}

/** invalidateListByType 失效指定 type 的顶层评论列表缓存 */
function invalidateListByType(
    qc: ReturnType<typeof useQueryClient>,
    postId: string,
    type: "free" | "annotation",
) {
    qc.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey;
            if (key[0] !== "comments" || key[1] !== "list") return false;
            if (key[2] !== postId) return false;
            const q = key[3] as { type?: string } | undefined;
            return q?.type === type;
        },
    });
}

/**
 * useSendCommentCode - 匿名评论第一步：POST /posts/{postId}/comments/code 发送邮箱验证码
 *
 * 仅匿名评论需要；登录用户不调用。后端挂 CommentCodeRateLimit（5/min/IP 防邮件轰炸）。
 * 验证码一次性、TTL 10min、5 次错误锁定。
 */
export const useSendCommentCode = (postId: string) => {
    return useMutation({
        mutationFn: (body: SendCodeBody) => apiPost<null>(`/posts/${postId}/comments/code`, body),
    });
};

/** useAddReaction - POST /comments/{commentId}/reactions 添加反应，按用户/IP 幂等
 *
 * 乐观更新：立即在单条/批量反应缓存中递增对应 emoji 计数并标记 self，避免 mutation
 * settle 后、缓存尚未刷新前的空窗期内用户重复点击导致重复提交。
 */
export const useAddReaction = (commentId: string) => {
    const qc = useQueryClient();
    const me = useMe({ enabled: true });

    return useMutation({
        mutationFn: (body: AddReaction) => apiPost<null>(`/comments/${commentId}/reactions`, body),
        onMutate: async (body) => {
            const userId = me.data?.id;
            if (!userId) return;
            const emoji = findEmojiById(qc, body.emoji_id);
            if (!emoji) return;

            await qc.cancelQueries({ queryKey: commentKeys.reactions() });
            const previousReactions = captureReactions(qc);
            optimisticAddReaction(qc, commentId, body.emoji_id, emoji.name, emoji.url);
            return { previousReactions };
        },
        onError: (_err, _body, context) => {
            if (!context?.previousReactions) return;
            restoreReactions(qc, context.previousReactions);
        },
        onSettled: () => {
            // 乐观更新后仍触发后台刷新，保证数据最终一致
            qc.invalidateQueries({ queryKey: commentKeys.reactions() });
        },
    });
};

/** useRemoveReaction - DELETE /comments/{commentId}/reactions/{emojiId} 移除反应
 *
 * 乐观更新：立即在缓存中递减对应 emoji 计数并取消 self 标记，避免重复点击抖动。
 */
export const useRemoveReaction = (commentId: string) => {
    const qc = useQueryClient();
    const me = useMe({ enabled: true });

    return useMutation({
        mutationFn: (emojiId: number) =>
            apiDelete<null>(`/comments/${commentId}/reactions/${emojiId}`),
        onMutate: async (emojiId) => {
            const userId = me.data?.id;
            if (!userId) return;

            await qc.cancelQueries({ queryKey: commentKeys.reactions() });
            const previousReactions = captureReactions(qc);
            optimisticRemoveReaction(qc, commentId, emojiId);
            return { previousReactions };
        },
        onError: (_err, _emojiId, context) => {
            if (!context?.previousReactions) return;
            restoreReactions(qc, context.previousReactions);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: commentKeys.reactions() });
        },
    });
};

/** findEmojiById - 从表情缓存按 ID 查找名称与图片 URL */
function findEmojiById(
    qc: ReturnType<typeof useQueryClient>,
    emojiId: number,
): { name: string; url: string } | null {
    const groups = qc.getQueryData<EmojiGroup[]>(emojiKeys.publicGroupList());
    if (!groups) return null;
    for (const group of groups) {
        const emoji = group.emojis.find((e) => e.id === emojiId);
        if (emoji) return { name: emoji.name, url: emoji.url };
    }
    return null;
}

/** isBatchReactionsKey - 是否为批量反应查询键 */
function isBatchReactionsKey(key: QueryKey): boolean {
    return key[0] === "comments" && key[1] === "reactions" && key[2] === "batch";
}

/** batchIncludesCommentId - 批量查询键是否包含指定评论 */
function batchIncludesCommentId(key: QueryKey, commentId: string): boolean {
    return Array.isArray(key[3]) && key[3].includes(commentId);
}

/** captureReactions - 捕获指定评论相关的反应缓存快照，用于回滚 */
function captureReactions(qc: ReturnType<typeof useQueryClient>): Map<QueryKey, unknown> {
    const previous = new Map<QueryKey, unknown>();
    qc.getQueryCache()
        .findAll({ queryKey: commentKeys.reactions() })
        .forEach((query) => {
            previous.set(query.queryKey, query.state.data);
        });
    return previous;
}

/** restoreReactions - 用快照恢复反应缓存 */
function restoreReactions(qc: ReturnType<typeof useQueryClient>, previous: Map<QueryKey, unknown>) {
    previous.forEach((data, key) => {
        qc.setQueryData(key, data);
    });
}

/** optimisticAddReaction - 在缓存中递增指定 emoji 计数并标记 self */
function optimisticAddReaction(
    qc: ReturnType<typeof useQueryClient>,
    commentId: string,
    emojiId: number,
    emojiName: string,
    emojiUrl: string,
) {
    const newReaction: Reaction = {
        emoji_id: emojiId,
        emoji_name: emojiName,
        emoji_url: emojiUrl,
        count: 1,
        self: true,
    };

    // 1. 单条评论反应列表（精确键）
    qc.setQueryData<Reaction[]>(commentKeys.reactionList(commentId), (old) => {
        if (!old) return old;
        const idx = old.findIndex((r) => r.emoji_id === emojiId);
        if (idx >= 0) {
            const existing = old[idx];
            if (existing.self) return old;
            const next = [...old];
            next[idx] = { ...existing, count: existing.count + 1, self: true };
            return next;
        }
        return [...old, newReaction];
    });

    // 2. 批量反应结果（按 predicate 定位包含该评论的 batch 缓存）
    qc.setQueriesData<BatchReactionResult[]>(
        {
            predicate: (query) =>
                isBatchReactionsKey(query.queryKey) &&
                batchIncludesCommentId(query.queryKey, commentId),
        },
        (old) => {
            if (!old) return old;
            return old.map((item) => {
                if (item.comment_id !== commentId) return item;
                const idx = item.reactions?.findIndex((r) => r.emoji_id === emojiId) ?? -1;
                if (idx >= 0) {
                    const existing = item.reactions[idx];
                    if (existing.self) return item;
                    const next = [...item.reactions];
                    next[idx] = { ...existing, count: existing.count + 1, self: true };
                    return { ...item, reactions: next };
                }
                return { ...item, reactions: [...(item.reactions ?? []), newReaction] };
            });
        },
    );
}

/** optimisticRemoveReaction - 在缓存中递减指定 emoji 计数并取消 self 标记 */
function optimisticRemoveReaction(
    qc: ReturnType<typeof useQueryClient>,
    commentId: string,
    emojiId: number,
) {
    const updateList = (list: Reaction[]): Reaction[] => {
        const idx = list.findIndex((r) => r.emoji_id === emojiId);
        if (idx < 0) return list;
        const existing = list[idx];
        if (!existing.self) return list;
        if (existing.count <= 1) {
            return list.filter((_, i) => i !== idx);
        }
        const next = [...list];
        next[idx] = { ...existing, count: existing.count - 1, self: false };
        return next;
    };

    // 1. 单条评论反应列表（精确键）
    qc.setQueryData<Reaction[]>(commentKeys.reactionList(commentId), (old) => {
        if (!old) return old;
        return updateList(old);
    });

    // 2. 批量反应结果
    qc.setQueriesData<BatchReactionResult[]>(
        {
            predicate: (query) =>
                isBatchReactionsKey(query.queryKey) &&
                batchIncludesCommentId(query.queryKey, commentId),
        },
        (old) => {
            if (!old) return old;
            return old.map((item) =>
                item.comment_id === commentId
                    ? { ...item, reactions: updateList(item.reactions ?? []) }
                    : item,
            );
        },
    );
}

/** useApproveComment - PATCH /comments/{id}/approve 审核通过，公共端点需管理员身份 */
export const useApproveComment = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPatch<null>(`/comments/${id}/approve`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: commentKeys.lists() });
        },
    });
};

/** useMarkCommentSpam - PATCH /comments/{id}/spam 标垃圾，公共端点需管理员身份 */
export const useMarkCommentSpam = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPatch<null>(`/comments/${id}/spam`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: commentKeys.lists() });
        },
    });
};

/** useDeleteComment - DELETE /comments/{id} 删除，公共端点需管理员身份 */
export const useDeleteComment = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiDelete<null>(`/comments/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: commentKeys.lists() });
        },
    });
};
