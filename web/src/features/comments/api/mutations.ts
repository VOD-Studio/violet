import type { Comment } from "@entities/comment/model/types";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
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
 * 后端返回 CommentDTO，登录态用于乐观展示自己的 pending 评论。
 *
 * 失效策略（精确到 type + replies 维度）：
 *   - 按 body.anchor 判断 type（free/annotation），只失效对应类型列表，避免互相牵连
 *   - 回复（parent_id 非空）：额外失效该顶层评论的 replies 缓存，让展开列表立即看到新回复
 *   - 顶层评论：list 缓存失效后，replies_total + 预览会随之刷新
 */
export const useCreateComment = (postId: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateComment) => apiPost<Comment>(`/posts/${postId}/comments`, body),
        onSuccess: (_data, variables) => {
            // variables.anchor 非空 → 批注（含批注回复，后端继承父 anchor）；空 → 自由评论
            const type = variables.anchor ? "annotation" : "free";
            // 失效对应 type 的列表（含 replies_total + 预览）
            qc.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    if (key[0] !== "comments" || key[1] !== "list") return false;
                    if (key[2] !== postId) return false;
                    const q = key[3] as { type?: string } | undefined;
                    return q?.type === type;
                },
            });
            // 回复：额外失效该顶层评论的 replies 缓存（展开列表立即看到新回复）
            if (variables.parent_id) {
                qc.invalidateQueries({
                    queryKey: commentKeys.replies(),
                });
            }
        },
    });
};

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
