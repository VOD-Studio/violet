import { apiGet } from "@shared/api/request";
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
 * useTags - 标签列表 hook
 *
 * 自动缓存与去重，标签更新频率低故沿用 QueryClient 默认 staleTime。
 */
export const useTags = () =>
	useQuery({
		queryKey: tagKeys.list(),
		queryFn: fetchTags,
	});
