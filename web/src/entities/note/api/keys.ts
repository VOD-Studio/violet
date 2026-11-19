import type { JournalQuery, PublicNoteListQuery } from "@entities/note/model/types";

/** 公开笔记 query key 工厂。 */
export const publishedNoteKeys = {
	all: ["published-notes"] as const,
	lists: () => [...publishedNoteKeys.all, "list"] as const,
	list: (query: PublicNoteListQuery) => [...publishedNoteKeys.lists(), query] as const,
	journal: (query: JournalQuery) => [...publishedNoteKeys.all, "journal", query] as const,
	progressDay: (projectId: string, day: string) =>
		[...publishedNoteKeys.all, "progress-day", projectId, day] as const,
	details: () => [...publishedNoteKeys.all, "detail"] as const,
	detail: (id: string) => [...publishedNoteKeys.details(), id] as const,
};
