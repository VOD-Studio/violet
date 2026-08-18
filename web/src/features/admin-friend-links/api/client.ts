import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost } from "@/shared/api/request";
import type { PagedResponse } from "@/shared/api/types";
import type {
	FriendLinkAdminDTO,
	FriendLinkListQuery,
	FriendLinkManualRequest,
} from "../model/types";

const BASE = "/admin/friend-links";

/** 按状态筛选,服务端分页 */
export const listFriendLinks = async (
	query: FriendLinkListQuery = {},
): Promise<PagedResponse<FriendLinkAdminDTO>> =>
	apiGetPaged<FriendLinkAdminDTO>(BASE, { params: query });

/** 后台菜单角标消费 */
export const countPendingFriendLinks = async (): Promise<{ count: number }> =>
	apiGet<{ count: number }>(`${BASE}/pending/count`);

/** 手动添加,直接 approved */
export const createFriendLink = async (
	body: FriendLinkManualRequest,
): Promise<FriendLinkAdminDTO> => apiPost<FriendLinkAdminDTO>(BASE, body);

/** 编辑字段/排序 */
export const updateFriendLink = async (
	id: string,
	body: FriendLinkManualRequest,
): Promise<FriendLinkAdminDTO> => apiPatch<FriendLinkAdminDTO>(`${BASE}/${id}`, body);

/** pending/rejected → approved(rejected 为改判) */
export const approveFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/approve`);

/** pending → rejected */
export const rejectFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/reject`);

/** approved → disabled(下柜) */
export const disableFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/disable`);

/** disabled → approved */
export const restoreFriendLink = async (id: string): Promise<void> =>
	apiPost<void>(`${BASE}/${id}/restore`);

/** 物理删除 */
export const deleteFriendLink = async (id: string): Promise<void> =>
	apiDelete<void>(`${BASE}/${id}`);
