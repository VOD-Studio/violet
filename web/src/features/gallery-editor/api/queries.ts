import type {
	GalleryDetail,
	GalleryListQuery,
	GallerySummary,
} from "@entities/gallery/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import { galleryKeys } from "./keys";

/** 读取当前作者的图集工作稿列表。 */
export function fetchAdminGalleries(
	query: GalleryListQuery = {},
): Promise<PagedResponse<GallerySummary>> {
	return apiGetPaged<GallerySummary>("/admin/galleries", { params: query });
}

/** 后台图集列表查询。 */
export function useAdminGalleries(query: GalleryListQuery = {}) {
	return useQuery({
		queryKey: galleryKeys.list(query),
		queryFn: () => fetchAdminGalleries(query),
	});
}

/** 读取一个图集工作稿。 */
export function fetchGalleryDraft(id: string): Promise<GalleryDetail> {
	return apiGet<GalleryDetail>(`/admin/galleries/${id}`);
}

/** 图集工作稿详情查询。 */
export function useGalleryDraft(id: string) {
	return useQuery({
		queryKey: galleryKeys.detail(id),
		queryFn: () => fetchGalleryDraft(id),
		enabled: id.length > 0,
	});
}
