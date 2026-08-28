/** galleries feature 写操作层（建图集 / 编辑图集 + 缓存联动） */

import { apiPatch, apiPost } from "@shared/api/request";
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
