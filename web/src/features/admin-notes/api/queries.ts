import type {
	AdminNote,
	AdminNoteListQuery,
	AdminNoteSummary,
} from "@features/admin-notes/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import { adminNoteKeys } from "./keys";

/** 读取后台笔记列表（含草稿）。 */
export function fetchAdminNotes(
	query: AdminNoteListQuery = {},
): Promise<PagedResponse<AdminNoteSummary>> {
	return apiGetPaged<AdminNoteSummary>("/admin/notes", { params: query });
}

/** 后台笔记列表查询。 */
export function useAdminNotes(query: AdminNoteListQuery = {}) {
	return useQuery({
		queryKey: adminNoteKeys.list(query),
		queryFn: () => fetchAdminNotes(query),
	});
}

/** 读取一条后台笔记。 */
export function fetchAdminNote(id: string): Promise<AdminNote> {
	return apiGet<AdminNote>(`/admin/notes/${id}`);
}

/** 后台笔记详情查询。 */
export function useAdminNote(id: string, enabled = true) {
	return useQuery({
		queryKey: adminNoteKeys.detail(id),
		queryFn: () => fetchAdminNote(id),
		enabled: enabled && id.length > 0,
	});
}
