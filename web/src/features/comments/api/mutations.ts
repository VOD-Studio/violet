import type { Comment } from "@entities/comment/model/types";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AddReaction, CreateComment, SendCodeBody } from "../model/types";
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
 *   - 回复（parent_id 非空）：用 setQueryData 把新回复追加到对应 replies 缓存末尾，
 *     同时更新顶层 list 缓存里该评论的 replies_total +1。用户提交后立即看到自己的 pending 回复，
 *     不会出现「我的评论消失了」的疑惑
 */
export const useCreateComment = (postId: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateComment) => apiPost<Comment>(`/posts/${postId}/comments`, body),
        onSuccess: (newComment, variables) => {
            // 回复：乐观插入到 replies 缓存 + 顶层 replies_total +1
            if (variables.parent_id) {
                optimisticAppendReply(qc, variables.parent_id, newComment);
                bumpTopLevelRepliesTotal(qc, postId, variables.parent_id);
            } else {
                // 顶层评论：直接失效 list 重拉（条目少，重拉保证 replies_total 等字段新鲜）
                invalidateListByType(qc, postId, variables.anchor ? "annotation" : "free");
            }
        },
    });
};

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
    qc.setQueriesData<{ pages: PagedResponse<Comment>[]; pageParams: number[] }>(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key[0] === "comments" && key[1] === "replies" && key[2] === parentCommentId;
            },
        },
        (old) => {
            if (!old || old.pages.length === 0) return old;
            const newPages = [...old.pages];
            // 第一页 data 末尾追加（ASC 时是最新的在末尾）
            newPages[0] = {
                ...newPages[0],
                data: [...newPages[0].data, newReply],
                pagination: {
                    ...newPages[0].pagination,
                    total: (newPages[0].pagination?.total ?? 0) + 1,
                },
            };
            return { ...old, pages: newPages };
        },
    );
}

/**
 * bumpTopLevelRepliesTotal 顶层列表缓存里，该顶层评论的 replies_total +1。
 *
 * 让「查看全部 xx 条回复」的数字立即更新，不用等重拉。
 * 遍历 list 缓存的所有页，找到该顶层评论，replies_total +1。
 */
function bumpTopLevelRepliesTotal(
    qc: ReturnType<typeof useQueryClient>,
    postId: string,
    topCommentId: string,
) {
    qc.setQueriesData<{ pages: PagedResponse<Comment>[]; pageParams: number[] }>(
        {
            predicate: (query) => {
                const key = query.queryKey;
                if (key[0] !== "comments" || key[1] !== "list") return false;
                if (key[2] !== postId) return false;
                return true;
            },
        },
        (old) => {
            if (!old || old.pages.length === 0) return old;
            const newPages = old.pages.map((page) => ({
                ...page,
                data: page.data.map((c) =>
                    c.id === topCommentId ? { ...c, replies_total: (c.replies_total ?? 0) + 1 } : c,
                ),
            }));
            return { ...old, pages: newPages };
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

/** useAddReaction - POST /comments/{commentId}/reactions 添加反应，按用户/IP 幂等 */
export const useAddReaction = (commentId: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AddReaction) => apiPost<null>(`/comments/${commentId}/reactions`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: commentKeys.reactionList(commentId) });
        },
    });
};

/** useRemoveReaction - DELETE /comments/{commentId}/reactions/{emojiId} 移除反应 */
export const useRemoveReaction = (commentId: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (emojiId: number) =>
            apiDelete<null>(`/comments/${commentId}/reactions/${emojiId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: commentKeys.reactionList(commentId) });
        },
    });
};

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
