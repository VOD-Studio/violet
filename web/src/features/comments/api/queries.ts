import { apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type {
	AdminComment,
	AdminCommentListQuery,
	BatchReactionResult,
	BatchReactionsQuery,
	Comment,
	CommentListQuery,
	PendingCountResponse,
	Reaction,
} from "../model/types";
import { commentKeys } from "./keys";

/**
 * fetchComments - 调后端 GET /posts/{postId}/comments 拉取文章已审核评论
 *
 * 仅返回已审核通过评论，按时间排序，分页。
 *
 * @param postId 文章 ID
 * @param query 分页参数
 * @returns 解包后的评论列表与分页元数据
 */
export const fetchComments = async (
	postId: string,
	query: CommentListQuery = {},
): Promise<PagedResponse<Comment>> =>
	apiGetPaged<Comment>(`/posts/${postId}/comments`, { params: query });

/**
 * useComments - 文章评论列表 hook
 *
 * @param postId 文章 ID
 * @param query 分页参数
 */
export const useComments = (postId: string, query: CommentListQuery = {}) =>
	useQuery({
		queryKey: commentKeys.list(postId, query),
		queryFn: () => fetchComments(postId, query),
	});

/**
 * fetchCommentReactions - 调后端 GET /comments/{commentId}/reactions 获取评论反应列表
 *
 * @param commentId 评论 ID
 * @returns 按 emoji 聚合后的反应列表
 */
export const fetchCommentReactions = async (
	commentId: string,
): Promise<Reaction[]> =>
	apiGet<Reaction[]>(`/comments/${commentId}/reactions`);

/**
 * useCommentReactions - 单条评论的反应列表 hook
 *
 * @param commentId 评论 ID
 */
export const useCommentReactions = (commentId: string) =>
	useQuery({
		queryKey: commentKeys.reactionList(commentId),
		queryFn: () => fetchCommentReactions(commentId),
	});

/**
 * fetchBatchReactions - 调后端 POST /comments/reactions/batch 批量获取评论反应
 *
 * 一次性查询多条评论的反应，用于列表页避免 N+1 请求。
 *
 * @param body 评论 ID 列表
 * @returns 每条评论对应的反应列表
 */
export const fetchBatchReactions = async (
	body: BatchReactionsQuery,
): Promise<BatchReactionResult[]> =>
	apiPost<BatchReactionResult[]>("/comments/reactions/batch", body);

/**
 * fetchPendingComments - 调后端 GET /admin/comments/pending 拉取待审核评论列表
 *
 * 需管理员身份。
 *
 * @param query 分页参数
 * @returns 解包后的待审核评论列表与分页元数据
 */
export const fetchPendingComments = async (
	query: CommentListQuery = {},
): Promise<PagedResponse<Comment>> =>
	apiGetPaged<Comment>("/admin/comments/pending", { params: query });

/**
 * usePendingComments - 待审核评论列表 hook
 *
 * @param query 分页参数
 */
export const usePendingComments = (query: CommentListQuery = {}) =>
	useQuery({
		queryKey: commentKeys.pendingList(query),
		queryFn: () => fetchPendingComments(query),
	});

/**
 * fetchPendingCommentCount - 调后端 GET /admin/comments/pending/count 获取待审核评论数量
 *
 * 需管理员身份，常用于后台角标。
 *
 * @returns 待审核评论数量
 */
export const fetchPendingCommentCount =
	async (): Promise<PendingCountResponse> =>
		apiGet<PendingCountResponse>("/admin/comments/pending/count");

/**
 * usePendingCommentCount - 待审核评论数量 hook
 *
 * 缓存 key 固定，便于多处复用同一份数据。
 */
export const usePendingCommentCount = () =>
	useQuery({
		queryKey: commentKeys.pendingCount(),
		queryFn: fetchPendingCommentCount,
	});

/**
 * fetchAdminComments - 调后端 GET /admin/comments 拉取所有评论列表
 *
 * 需管理员身份，支持状态筛选，分页。
 *
 * @param query 分页与状态筛选参数
 * @returns 解包后的评论列表与分页元数据
 */
export const fetchAdminComments = async (
	query: AdminCommentListQuery = {},
): Promise<PagedResponse<AdminComment>> =>
	apiGetPaged<AdminComment>("/admin/comments", { params: query });

/**
 * useAdminComments - 后台评论列表 hook
 *
 * @param query 分页与状态筛选参数
 */
export const useAdminComments = (query: AdminCommentListQuery = {}) =>
	useQuery({
		queryKey: commentKeys.adminList(query),
		queryFn: () => fetchAdminComments(query),
	});

/**
 * fetchAdminCommentDetail - 调后端 GET /admin/comments/{id} 获取评论详情
 *
 * 需管理员身份，返回包含所属文章信息。
 *
 * @param id 评论 ID
 * @returns 评论详情
 */
export const fetchAdminCommentDetail = async (
	id: string,
): Promise<AdminComment> => apiGet<AdminComment>(`/admin/comments/${id}`);

/**
 * useAdminCommentDetail - 后台评论详情 hook
 *
 * @param id 评论 ID
 */
export const useAdminCommentDetail = (id: string) =>
	useQuery({
		queryKey: commentKeys.adminDetail(id),
		queryFn: () => fetchAdminCommentDetail(id),
	});
