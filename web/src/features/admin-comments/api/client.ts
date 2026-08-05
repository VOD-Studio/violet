import { apiDelete, apiGet, apiGetPaged, apiPatch } from "@/shared/api/request";
import type { PagedResponse } from "@/shared/api/types";
import type {
	AdminComment,
	BatchUpdateCommentsRequest,
	Comment,
	CommentListQuery,
} from "../model/types";

const BASE = "/admin/comments";

/** listPendingComments - 调 GET /admin/comments/pending（待审核列表，分页） */
export const listPendingComments = async (
	query: { page?: number; limit?: number } = {},
): Promise<PagedResponse<Comment>> => apiGetPaged<Comment>(`${BASE}/pending`, { params: query });

/** countPendingComments - 调 GET /admin/comments/pending/count */
export const countPendingComments = async (): Promise<{ count: number }> =>
	apiGet<{ count: number }>(`${BASE}/pending/count`);

/** listAllComments - 调 GET /admin/comments（全部列表，按状态筛选，分页） */
export const listAllComments = async (
	query: CommentListQuery = {},
): Promise<PagedResponse<AdminComment>> => apiGetPaged<AdminComment>(BASE, { params: query });

/** getCommentDetail - 调 GET /admin/comments/{id} */
export const getCommentDetail = async (id: string): Promise<AdminComment> =>
	apiGet<AdminComment>(`${BASE}/${id}`);

/** batchUpdateComments - 调 PATCH /admin/comments/batch-status */
export const batchUpdateComments = async (
	body: BatchUpdateCommentsRequest,
): Promise<{ affected: number }> => apiPatch<{ affected: number }>(`${BASE}/batch-status`, body);

/** approveComment - 调 PATCH /comments/{id}/approve（公共审核动作） */
export const approveComment = async (id: string): Promise<void> =>
	apiPatch<void>(`/comments/${id}/approve`);

/** markCommentSpam - 调 PATCH /comments/{id}/spam（公共审核动作） */
export const markCommentSpam = async (id: string): Promise<void> =>
	apiPatch<void>(`/comments/${id}/spam`);

/** deleteComment - 调 DELETE /comments/{id}（公共审核动作） */
export const deleteComment = async (id: string): Promise<void> =>
	apiDelete<void>(`/comments/${id}`);
