import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { MediaCatalogQuery, MediaFile } from "../model/types";
import { mediaCatalogKeys } from "./keys";

export type MediaCatalogSource = "all" | "owned";

/** 查询全局素材目录，或仅查询当前用户自己的素材。 */
export const fetchMediaCatalog = async (
	query: MediaCatalogQuery = {},
	source: MediaCatalogSource = "all",
): Promise<PagedResponse<MediaFile>> => {
	const { page, limit, purpose, type, category, keyword } = query;
	return apiGetPaged<MediaFile>(source === "owned" ? "/media" : "/admin/media", {
		params: { page, limit, purpose, type, category, keyword },
	});
};

export const useMediaCatalog = (
	query: MediaCatalogQuery = {},
	source: MediaCatalogSource = "all",
) =>
	useQuery({
		queryKey:
			source === "owned" ? mediaCatalogKeys.ownedList(query) : mediaCatalogKeys.list(query),
		queryFn: () => fetchMediaCatalog(query, source),
	});

export const useInfiniteMediaCatalog = (query: Omit<MediaCatalogQuery, "page"> = {}) =>
	useInfiniteQuery({
		queryKey: mediaCatalogKeys.infinite(query),
		queryFn: ({ pageParam = 1 }) => fetchMediaCatalog({ ...query, page: pageParam }),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const { page = 1, limit = 50, total = 0 } = lastPage.pagination;
			const totalPages = Math.ceil(total / limit);
			return page < totalPages ? page + 1 : undefined;
		},
	});
