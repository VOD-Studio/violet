import { publishedNoteKeys } from "@entities/note/api/keys";
import type { AdminNote, NoteSaveRequest } from "@features/admin-notes/model/types";
import { apiDelete, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminNoteKeys } from "./keys";

function invalidateNoteCaches(queryClient: ReturnType<typeof useQueryClient>, note?: AdminNote) {
	queryClient.invalidateQueries({ queryKey: adminNoteKeys.lists() });
	// 公开侧地址按 ID，无 slug，直接失效整个公开笔记族
	queryClient.invalidateQueries({ queryKey: publishedNoteKeys.all });
	if (note) {
		queryClient.setQueryData(adminNoteKeys.detail(note.id), note);
		if (note.published_at) {
			queryClient.invalidateQueries({
				queryKey: publishedNoteKeys.detail(note.id),
			});
		}
	}
}

/** 创建草稿笔记；正文必填，content_html 由服务端渲染。 */
export function useCreateNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: NoteSaveRequest) => apiPost<AdminNote>("/admin/notes", input),
		onSuccess: (note) => invalidateNoteCaches(queryClient, note),
	});
}

/** 全量保存笔记；状态与首次发布时间不变。 */
export function useSaveNote(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: NoteSaveRequest) => apiPut<AdminNote>(`/admin/notes/${id}`, input),
		onSuccess: (note) => invalidateNoteCaches(queryClient, note),
	});
}

/** 发布笔记；已发布时幂等。 */
export function usePublishNote(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => apiPost<AdminNote>(`/admin/notes/${id}/publish`),
		onSuccess: (note) => invalidateNoteCaches(queryClient, note),
	});
}

/** 物理删除笔记（note_tags 级联）。 */
export function useDeleteNote(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/notes/${id}`),
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: adminNoteKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: adminNoteKeys.lists() });
			queryClient.invalidateQueries({ queryKey: publishedNoteKeys.all });
		},
	});
}
