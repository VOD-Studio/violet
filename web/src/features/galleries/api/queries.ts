import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PageQuery } from "@shared/api/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GalleryDetail, GallerySummary } from "../model/types";
import { galleryKeys } from "./keys";

/** 浏览流每页条数（页面与分页组件共用） */
export const GALLERY_PAGE_SIZE = 12;

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

/** 浏览流分页查询（仅 published，时间倒序）。 */
export const fetchGalleries = async (query: PageQuery) =>
	apiGetPaged<GallerySummary>("/galleries", { params: query });

export const useGalleries = (query: PageQuery) =>
	useQuery({
		queryKey: galleryKeys.list(query),
		queryFn: () => fetchGalleries(query),
		placeholderData: keepPreviousData,
	});
