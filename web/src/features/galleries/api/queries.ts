import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { GalleryDetail } from "../model/types";
import { galleryKeys } from "./keys";

/**
 * 图集详情查询。removed 状态后端返回 404，调用方按 error 分支处理。
 *
 * @param id 图集 ID
 */
export const fetchGalleryDetail = async (id: string): Promise<GalleryDetail> =>
	apiGet<GalleryDetail>(`/galleries/${id}`);

export const useGalleryDetail = (id: string) =>
	useQuery({
		queryKey: galleryKeys.detail(id),
		queryFn: () => fetchGalleryDetail(id),
		enabled: !!id,
	});
