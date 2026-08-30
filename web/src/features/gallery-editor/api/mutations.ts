import type { GalleryDetail } from "@entities/gallery/model/types";
import type { SaveGalleryInput } from "@features/gallery-editor/model/types";
import { apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryKeys } from "./keys";

/** 创建一个允许内容为空的图集工作稿。 */
export function useCreateGalleryDraft() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => apiPost<GalleryDetail>("/admin/galleries"),
		onSuccess: (draft) => {
			queryClient.setQueryData(galleryKeys.detail(draft.id), draft);
			queryClient.invalidateQueries({ queryKey: galleryKeys.lists() });
		},
	});
}

/** 以完整 document 保存一个图集工作稿。 */
export function useSaveGalleryDraft(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: SaveGalleryInput) =>
			apiPut<GalleryDetail>(`/admin/galleries/${id}`, input),
		onSuccess: (saved) => {
			queryClient.setQueryData(galleryKeys.detail(id), saved);
			queryClient.invalidateQueries({ queryKey: galleryKeys.lists() });
		},
	});
}
