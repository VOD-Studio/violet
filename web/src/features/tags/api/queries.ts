import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { Tag } from "../model/types";
import { tagKeys } from "./keys";

/**
 * fetchTags - 调 GET /api/v1/tags 拉取全部公开标签
 *
 * 后端 List 接口返回全量标签数组，无分页。
 *
 * @returns 标签列表
 */
export const fetchTags = async (): Promise<Tag[]> => {
	return await apiGet<Tag[]>("/tags");
};

/**
 * fetchTagsPaged - 调 GET /api/v1/tags?page=&limit= 拉取分页标签
 *
 * 带分页参数时后端返回 paged 信封；后台标签管理页使用。
 */
export const fetchTagsPaged = async (query: PageQuery): Promise<PagedResponse<Tag>> =>
	apiGetPaged<Tag>("/tags", { params: query });

/**
 * useTags - 标签列表 hook
 *
 * 自动缓存与去重，标签更新频率低故沿用 QueryClient 默认 staleTime。
 */
export const useTags = () =>
	useQuery({
		queryKey: tagKeys.list(),
		queryFn: fetchTags,
	});

/**
 * useTagsPaged - 分页标签列表 hook（后台标签管理页用）
 */
export const useTagsPaged = (query: PageQuery) =>
	useQuery({
		queryKey: [...tagKeys.lists(), query],
		queryFn: () => fetchTagsPaged(query),
	});
