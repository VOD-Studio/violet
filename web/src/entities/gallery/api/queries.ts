import type { PublishedGallery, PublishedGalleryListQuery } from "@entities/gallery/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { publishedGalleryKeys } from "./keys";

/** 读取一页已发布图集。 */
export function fetchPublishedGalleries(
	query: PublishedGalleryListQuery = {},
): Promise<PagedResponse<PublishedGallery>> {
	return apiGetPaged<PublishedGallery>("/galleries", { params: query });
}

/** 公开图集列表查询。 */
export function usePublishedGalleries(query: PublishedGalleryListQuery = {}) {
	return useQuery({
		queryKey: publishedGalleryKeys.list(query),
		queryFn: () => fetchPublishedGalleries(query),
	});
}

/** 将公开图集的游标页组合为可重试的连续浏览流。 */
export function usePublishedGalleryFeed(limit: number) {
	const first = usePublishedGalleries({ limit });
	const [cursors, setCursors] = useState<string[]>([]);
	const more = useQueries({
		queries: cursors.map((cursor) => ({
			queryKey: publishedGalleryKeys.list({ cursor, limit }),
			queryFn: () => fetchPublishedGalleries({ cursor, limit }),
		})),
	});
	const pages = [first.data, ...more.map((query) => query.data)].filter(
		(page) => page !== undefined,
	);
	const lastPage = pages.at(-1);
	const lastMore = more.at(-1);
	const nextCursor = lastPage?.pagination.next_cursor;
	const loadMoreFailed = lastMore?.isError ?? false;

	const loadMore = () => {
		if (loadMoreFailed) {
			void lastMore?.refetch();
			return;
		}
		if (!nextCursor) return;
		setCursors((current) =>
			current.includes(nextCursor) ? current : [...current, nextCursor],
		);
	};

	return {
		galleries: pages.flatMap((page) => page.data),
		isLoading: first.isLoading,
		isError: first.isError,
		refetch: first.refetch,
		hasMore: Boolean(nextCursor),
		loadingMore: lastMore?.isLoading ?? false,
		loadMoreFailed,
		loadMore,
	};
}

/** 读取一个已发布图集。 */
export function fetchPublishedGallery(slug: string): Promise<PublishedGallery> {
	return apiGet<PublishedGallery>(`/galleries/${encodeURIComponent(slug)}`);
}

/** 公开图集详情查询。 */
export function usePublishedGallery(slug: string) {
	return useQuery({
		queryKey: publishedGalleryKeys.detail(slug),
		queryFn: () => fetchPublishedGallery(slug),
		enabled: slug.length > 0,
	});
}
