import type { PublicNote, PublicNoteListQuery } from "@entities/note/model/types";
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

export function publishedNotesQueryOptions(query: PublicNoteListQuery = {}) {
	return queryOptions({
		queryKey: publishedNoteKeys.list(query),
		queryFn: () => fetchPublishedNotes(query),
	});
}

export function usePublishedNotes(query: PublicNoteListQuery = {}) {
	return useQuery(publishedNotesQueryOptions(query));
}

/** 筛选变更时从首页续读；末页请求失败时保留已读条目。 */
export function usePublishedNotesFeed(query: Omit<PublicNoteListQuery, "cursor">) {
	const first = usePublishedNotes(query);
	const key = hashKey(publishedNoteKeys.list(query));
	const [feed, setFeed] = useState<{ key: string; cursors: string[] }>({ key, cursors: [] });
	const cursors = feed.key === key ? feed.cursors : [];
	if (feed.key !== key) setFeed({ key, cursors });

	const more = useQueries({
		queries: cursors.map((cursor) => publishedNotesQueryOptions({ ...query, cursor })),
	});
	const lastMore = more.at(-1);
	let nextCursor = first.data?.pagination.next_cursor;
	const notes: PublicNote[] = [];
	const seen = new Set<string>();
	for (const page of [first, ...more]) {
		if (!page.data) break;
		for (const note of page.data.data) {
			if (seen.has(note.id)) continue;
			seen.add(note.id);
			notes.push(note);
		}
		nextCursor = page.data.pagination.next_cursor;
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
		notes,
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
