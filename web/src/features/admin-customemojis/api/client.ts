import { apiDelete, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import type { AdminCustomEmoji } from "../model/types";

const BASE = "/admin/emojis/custom";

export const listAdminCustomEmojis = async (
	keyword: string,
	query: PageQuery,
): Promise<PagedResponse<AdminCustomEmoji>> =>
	apiGetPaged<AdminCustomEmoji>(BASE, { params: { keyword: keyword || undefined, ...query } });

/** 下架走用户侧端点：应用层按 owner 或 customemoji:manage 双轨鉴权 */
export const deleteCustomEmoji = async (id: string): Promise<null> =>
	apiDelete<null>(`/custom-emojis/${id}`);
