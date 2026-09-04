import type { PublicNoteListQuery } from "@entities/note/model/types";

/** 公开笔记 query key 工厂。 */
export const publishedNoteKeys = {
	all: ["published-notes"] as const,
	lists: () => [...publishedNoteKeys.all, "list"] as const,
	list: (query: PublicNoteListQuery) => [...publishedNoteKeys.lists(), query] as const,
	details: () => [...publishedNoteKeys.all, "detail"] as const,
	detail: (id: string) => [...publishedNoteKeys.details(), id] as const,
};
