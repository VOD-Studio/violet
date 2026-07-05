import { apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type {
    BatchReactionResult,
    BatchReactionsQuery,
    Comment,
    CommentListQuery,
    Reaction,
} from "../model/types";
import { commentKeys } from "./keys";

/**
 * fetchComments - 调后端 GET /posts/{postId}/comments 拉取文章评论
 *
 * 黑洞模式（PRD-0001）：后端按 cookie 里的 viewerUserID 判定——
 *   - 匿名 viewer（无会话）：返回空数组（看不到任何评论，含自己刚提交的）
 *   - 登录 viewer：返回 approved 联合自己的 pending（带「审批中」徽章）
 *
 * type query param 控制按 anchor 维度过滤（free / annotation / all），
 * 把自由评论与批注在接口层彻底分开：底部评论区用 free，批注角标层用 annotation。
 * 前端无需额外过滤，按返回结果直接渲染即可。
 */
export const fetchComments = async (
    postId: string,
    query: CommentListQuery = {},
): Promise<PagedResponse<Comment>> =>
    apiGetPaged<Comment>(`/posts/${postId}/comments`, { params: query });

/** useComments - 文章评论列表 hook（支持 type 维度过滤） */
export const useComments = (postId: string, query: CommentListQuery = {}) =>
    useQuery({
        queryKey: commentKeys.list(postId, query),
        queryFn: () => fetchComments(postId, query),
    });

/**
 * useAnnotationComments - 批注专用便捷 hook
 *
 * 固定 type='annotation'，调用方一眼看出意图是「拿批注，不是拿评论」。
 * 缓存键与 free/all 隔离（commentKeys.list 带 query 对象），互不污染。
 */
export const useAnnotationComments = (postId: string) =>
    useComments(postId, { type: "annotation" });

/** fetchCommentReactions - GET /comments/{commentId}/reactions 评论反应列表 */
export const fetchCommentReactions = async (commentId: string): Promise<Reaction[]> =>
    apiGet<Reaction[]>(`/comments/${commentId}/reactions`);

/** useCommentReactions - 单条评论反应列表 hook */
export const useCommentReactions = (commentId: string) =>
    useQuery({
        queryKey: commentKeys.reactionList(commentId),
        queryFn: () => fetchCommentReactions(commentId),
    });

/** fetchBatchReactions - POST /comments/reactions/batch 批量获取反应，避免 N+1 */
export const fetchBatchReactions = async (
    body: BatchReactionsQuery,
): Promise<BatchReactionResult[]> =>
    apiPost<BatchReactionResult[]>("/comments/reactions/batch", body);
