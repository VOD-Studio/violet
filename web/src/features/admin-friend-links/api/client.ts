import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost } from "@/shared/api/request";
import type { PagedResponse } from "@/shared/api/types";
import type {
	FriendLinkAdminDTO,
	FriendLinkListQuery,
	FriendLinkManualRequest,
} from "../model/types";

const BASE = "/admin/friend-links";

/** listFriendLinks - 调 GET /admin/friend-links（按状态筛选，分页） */
export const listFriendLinks = async (
	query: FriendLinkListQuery = {},
): Promise<PagedResponse<FriendLinkAdminDTO>> =>
	apiGetPaged<FriendLinkAdminDTO>(BASE, { params: query });

/** countPendingFriendLinks - 调 GET /admin/friend-links/pending/count */
export const countPendingFriendLinks = async (): Promise<{ count: number }> =>
	apiGet<{ count: number }>(`${BASE}/pending/count`);

/** createFriendLink - 调 POST /admin/friend-links（手动添加，直接 approved） */
export const createFriendLink = async (
	body: FriendLinkManualRequest,
): Promise<FriendLinkAdminDTO> => apiPost<FriendLinkAdminDTO>(BASE, body);

/** updateFriendLink - 调 PATCH /admin/friend-links/{id}（编辑字段/排序） */
export const updateFriendLink = async (
	id: string,
	body: FriendLinkManualRequest,
): Promise<FriendLinkAdminDTO> => apiPatch<FriendLinkAdminDTO>(`${BASE}/${id}`, body);

/** approveFriendLink - 调 POST /admin/friend-links/{id}/approve（pending/rejected → approved） */
export const approveFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/approve`);

/** rejectFriendLink - 调 POST /admin/friend-links/{id}/reject（pending → rejected） */
export const rejectFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/reject`);

/** disableFriendLink - 调 POST /admin/friend-links/{id}/disable（approved → disabled） */
export const disableFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/disable`);

/** restoreFriendLink - 调 POST /admin/friend-links/{id}/restore（disabled → approved） */
export const restoreFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/restore`);

/** deleteFriendLink - 调 DELETE /admin/friend-links/{id}（物理删除） */
export const deleteFriendLink = async (id: string): Promise<void> =>
	apiDelete<void>(`${BASE}/${id}`);
