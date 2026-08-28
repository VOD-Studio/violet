import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateGalleryInput, GalleryDetail, UpdateGalleryInput } from "../model/types";
import { galleryKeys } from "./keys";

/** 建图集；onSuccess 返回新图集详情（含 id，调用方据此跳转）。 */
export const useCreateGallery = () =>
	useMutation({
		mutationFn: (input: CreateGalleryInput) => apiPost<GalleryDetail>("/galleries", input),
	});

/**
 * 编辑图集（owner）。items 为全量替换语义——增删改排序一次提交；
 * 成功后把返回详情回写 detail 缓存，编辑页无需二次拉取。
 *
 * @param id 图集 ID
 */
export const useUpdateGallery = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateGalleryInput) =>
			apiPatch<GalleryDetail>(`/galleries/${id}`, input),
		onSuccess: (detail) => {
			qc.setQueriesData<GalleryDetail>({ queryKey: galleryKeys.detail(id) }, detail);
		},
	});
};

/**
 * 治理下架/恢复（removed ↔ published，需 gallery:delete-any）。
 * 成功后失效全部列表缓存（浏览流/用户主页/管理列表统一重拉）。
 */
export const useSetGalleryStatus = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { id: string; status: "published" | "removed" }) =>
			apiPatch<null>(`/galleries/${input.id}/status`, { status: input.status }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: galleryKeys.all });
		},
	});
};

/**
 * 删除图集（作者本人或 gallery:delete-any，物理删并解绑引用计数）。
 */
export const useDeleteGallery = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/galleries/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: galleryKeys.all });
		},
	});
};
