import type { MediaFile } from "@entities/media/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { MediaListQuery } from "../model/types";
import { mediaKeys } from "./keys";

/**
 * fetchMedia - 调后端 GET /media/{id} 拉取媒体详情，公开接口
 *
 * @param id 媒体 ID
 */
export const fetchMedia = async (id: string): Promise<MediaFile> =>
	apiGet<MediaFile>(`/media/${id}`);

/**
 * useMedia - 媒体详情 hook，公开接口无需鉴权
 *
 * @param id 媒体 ID
 */
export const useMedia = (id: string) =>
	useQuery({
		queryKey: mediaKeys.detail(id),
		queryFn: () => fetchMedia(id),
		enabled: !!id,
	});

/**
 * fetchMediaList - 调后端 GET /media 拉取当前用户媒体列表
 *
 * 需鉴权，httpClient 自动携带 cookie。purpose 为用途筛选。
 */
export const fetchMediaList = async (
	query: MediaListQuery = {},
): Promise<PagedResponse<MediaFile>> => {
	const { page, limit, purpose } = query;
	return apiGetPaged<MediaFile>("/media", {
		params: { page, limit, purpose },
	});
};

/**
 * useMediaList - 当前用户媒体列表 hook
 *
 * @param query 分页与用途筛选
 */
export const useMediaList = (query: MediaListQuery = {}) =>
	useQuery({
		queryKey: mediaKeys.list(query),
		queryFn: () => fetchMediaList(query),
	});
