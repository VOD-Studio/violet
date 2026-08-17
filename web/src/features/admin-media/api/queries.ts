import type { MediaFile } from "@entities/media/model/types";
import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AdminMediaListQuery } from "../model/types";
import { adminMediaKeys } from "./keys";

/**
 * fetchAdminMedia - 调后端 GET /admin/media 拉取全局素材列表
 *
 * 需 media:upload 或 media:delete 权限，不限 owner，支持多维筛选。
 */
export const fetchAdminMedia = async (
	query: AdminMediaListQuery = {},
): Promise<PagedResponse<MediaFile>> => {
	const { page, limit, purpose, type, category, keyword } = query;
	return apiGetPaged<MediaFile>("/admin/media", {
		params: { page, limit, purpose, type, category, keyword },
	});
};

/**
 * useAdminMedia - 全局素材列表 Hook（表格分页用）
 *
 * @param query - 分页与多维筛选参数
 */
export const useAdminMedia = (query: AdminMediaListQuery = {}) =>
	useQuery({
		queryKey: adminMediaKeys.list(query),
		queryFn: () => fetchAdminMedia(query),
	});

/**
 * useAdminInfiniteMedia - 全局素材无限滚动列表 Hook（网格触底加载用）
 *
 * @param query - 多维筛选参数（不含 page）
 */
export const useAdminInfiniteMedia = (query: Omit<AdminMediaListQuery, "page"> = {}) =>
	useInfiniteQuery({
		queryKey: adminMediaKeys.infinite(query),
		queryFn: ({ pageParam = 1 }) => fetchAdminMedia({ ...query, page: pageParam }),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const { page = 1, limit = 50, total = 0 } = lastPage.pagination;
			const totalPages = Math.ceil(total / limit);
			return page < totalPages ? page + 1 : undefined;
		},
	});
