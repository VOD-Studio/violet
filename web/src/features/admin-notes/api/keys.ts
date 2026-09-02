import type { AdminNoteListQuery } from "@features/admin-notes/model/types";

/** 后台笔记 query key 工厂。 */
export const adminNoteKeys = {
	all: ["admin-notes"] as const,
	lists: () => [...adminNoteKeys.all, "list"] as const,
	list: (query: AdminNoteListQuery) => [...adminNoteKeys.lists(), query] as const,
	details: () => [...adminNoteKeys.all, "detail"] as const,
	detail: (id: string) => [...adminNoteKeys.details(), id] as const,
};
