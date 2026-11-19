import type {
	JournalEntry,
	JournalPage,
	JournalQuery,
	ProgressDay,
	PublicNote,
	PublicNoteListQuery,
} from "@entities/note/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { hashKey, queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { publishedNoteKeys } from "./keys";

/** 读取一页已发布笔记。 */
export function fetchPublishedNotes(
	query: PublicNoteListQuery = {},
): Promise<PagedResponse<PublicNote>> {
	return apiGetPaged<PublicNote>("/notes", { params: query });
}

export function journalQueryOptions(query: JournalQuery) {
	return queryOptions({
		queryKey: publishedNoteKeys.journal(query),
		queryFn: ({ signal }) => apiGet<JournalPage>("/journal", { params: query, signal }),
	});
}

/** 同一项目日卡跨页只出现一次。 */
export function journalEntryKey(entry: JournalEntry): string {
	return entry.kind === "note"
		? `note:${entry.note.id}`
		: `progress:${entry.progress.project.id}:${entry.progress.day}`;
}

/** 筛选变更时从首页续读；末页请求失败时保留已读条目。 */
export function useJournalFeed(query: Omit<JournalQuery, "cursor">) {
	const first = useQuery(journalQueryOptions(query));
	const key = hashKey(publishedNoteKeys.journal(query));
	const [feed, setFeed] = useState<{ key: string; cursors: string[] }>({ key, cursors: [] });
	const cursors = feed.key === key ? feed.cursors : [];
	if (feed.key !== key) setFeed({ key, cursors });

	const more = useQueries({
		queries: cursors.map((cursor) => journalQueryOptions({ ...query, cursor })),
	});
	const lastMore = more.at(-1);
	let nextCursor = first.data?.next_cursor;
	const entries: JournalEntry[] = [];
	const seen = new Set<string>();
	for (const page of [first, ...more]) {
		if (!page.data) break;
		for (const entry of page.data.entries) {
			const entryKey = journalEntryKey(entry);
			if (seen.has(entryKey)) continue;
			seen.add(entryKey);
			entries.push(entry);
		}
		nextCursor = page.data.next_cursor;
	}

	const loadingMore = lastMore?.isFetching ?? false;
	const loadMoreFailed = lastMore?.isError ?? false;
	const loadMore = () => {
		if (loadingMore) return;
		if (loadMoreFailed) {
			void lastMore?.refetch();
			return;
		}
		const cursor = nextCursor;
		if (!cursor) return;
		setFeed((current) =>
			current.key !== key || current.cursors.includes(cursor)
				? current
				: { key, cursors: [...current.cursors, cursor] },
		);
	};

	return {
		entries,
		progress: first.data?.progress ?? null,
		isLoading: first.isLoading,
		isError: first.isError && !first.data,
		refetch: first.refetch,
		hasMore:
			loadMoreFailed || loadingMore || Boolean(nextCursor && !cursors.includes(nextCursor)),
		loadingMore,
		loadMoreFailed,
		loadMore,
	};
}

export function useJournalProgressDay(projectId: string, day: string, enabled: boolean) {
	return useQuery({
		queryKey: publishedNoteKeys.progressDay(projectId, day),
		queryFn: ({ signal }) =>
			apiGet<ProgressDay>(
				`/journal/progress/${encodeURIComponent(projectId)}/${encodeURIComponent(day)}`,
				{ signal },
			),
		enabled,
		retry: false,
	});
}

function fetchPublishedNote(id: string): Promise<PublicNote> {
	return apiGet<PublicNote>(`/notes/${encodeURIComponent(id)}`);
}

export function publishedNoteQueryOptions(id: string) {
	return queryOptions({
		queryKey: publishedNoteKeys.detail(id),
		queryFn: () => fetchPublishedNote(id),
		enabled: id.length > 0,
	});
}

export function usePublishedNote(id: string) {
	return useQuery(publishedNoteQueryOptions(id));
}
