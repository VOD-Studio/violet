import type { PublicNote, PublicNoteListQuery } from "@entities/note/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { publishedNoteKeys } from "./keys";

/** 读取一页已发布笔记。 */
export function fetchPublishedNotes(
	query: PublicNoteListQuery = {},
): Promise<PagedResponse<PublicNote>> {
	return apiGetPaged<PublicNote>("/notes", { params: query });
}

/** 公开笔记列表查询。 */
export function usePublishedNotes(query: PublicNoteListQuery = {}) {
	return useQuery({
		queryKey: publishedNoteKeys.list(query),
		queryFn: () => fetchPublishedNotes(query),
	});
}

/** 将公开笔记的游标页组合为可重试的连续浏览流；tag 切换时重置已加载页。 */
export function usePublishedNotesFeed(limit: number, tag?: string) {
	const activeTag = tag?.trim() || undefined;
	const first = usePublishedNotes({ limit, tag: activeTag });
	const [cursors, setCursors] = useState<string[]>([]);
	const [lastTag, setLastTag] = useState(activeTag);
	// 标签切换时旧游标属于上一份流，渲染期清空从头续读（React 状态调整模式）
	if (lastTag !== activeTag) {
		setLastTag(activeTag);
		setCursors([]);
	}

	const more = useQueries({
		queries: cursors.map((cursor) => ({
			queryKey: publishedNoteKeys.list({ cursor, limit, tag: activeTag }),
			queryFn: () => fetchPublishedNotes({ cursor, limit, tag: activeTag }),
		})),
	});
	const pages = [first.data, ...more.map((query) => query.data)].filter(
		(page) => page !== undefined,
	);
	const lastPage = pages.at(-1);
	const lastMore = more.at(-1);
	const nextCursor = lastPage?.pagination.next_cursor;
	const loadMoreFailed = lastMore?.isError ?? false;

	const loadMore = () => {
		if (loadMoreFailed) {
			void lastMore?.refetch();
			return;
		}
		if (!nextCursor) return;
		setCursors((current) =>
			current.includes(nextCursor) ? current : [...current, nextCursor],
		);
	};

	return {
		notes: pages.flatMap((page) => page.data),
		isLoading: first.isLoading,
		isError: first.isError,
		refetch: first.refetch,
		hasMore: Boolean(nextCursor),
		loadingMore: lastMore?.isLoading ?? false,
		loadMoreFailed,
		loadMore,
	};
}

/** 读取一条已发布笔记。 */
export function fetchPublishedNote(id: string): Promise<PublicNote> {
	return apiGet<PublicNote>(`/notes/${encodeURIComponent(id)}`);
}

/** 公开笔记详情查询。 */
export function usePublishedNote(id: string) {
	return useQuery({
		queryKey: publishedNoteKeys.detail(id),
		queryFn: () => fetchPublishedNote(id),
		enabled: id.length > 0,
	});
}
