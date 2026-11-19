import type { PublicNote, PublicNoteListQuery } from "@entities/note/model/types";
import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishedNoteKeys } from "../keys";
import { publishedNotesQueryOptions, usePublishedNotesFeed } from "../queries";

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
}));

const mockGet = vi.mocked(apiGetPaged);

function note(id: string): PublicNote {
	return {
		id,
		title: id,
		content_html: "",
		tags: [],
		published_at: "2026-09-02T10:00:00Z",
		type: "unclassified",
		project: null,
		pitfall: null,
	};
}

function page(nextCursor?: string, ...notes: PublicNote[]): PagedResponse<PublicNote> {
	return { data: notes, pagination: { limit: 24, next_cursor: nextCursor } };
}

function createWrapper(
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	mockGet.mockReset();
});

describe("publishedNotesQueryOptions", () => {
	it("首屏复用预取笔记，作者更新后能刷新当前手记列表", async () => {
		const query: PublicNoteListQuery = {
			limit: 24,
			type: "pitfall",
			tag: "redis",
			project_id: "0e9bc14a-3588-4dc1-9862-02562b6d6ee0",
		};
		const initialNote = { ...note("n1"), type: "pitfall" } satisfies PublicNote;
		mockGet.mockResolvedValueOnce(page(undefined, initialNote));
		const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
		await client.ensureQueryData(publishedNotesQueryOptions(query));
		const { result } = renderHook(() => usePublishedNotesFeed(query), {
			wrapper: createWrapper(client),
		});
		expect(result.current.notes).toEqual([initialNote]);
		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet).toHaveBeenCalledWith("/notes", expect.objectContaining({ params: query }));

		const editedNote = { ...initialNote, title: "修正后的手记标题" };
		mockGet.mockResolvedValueOnce(page(undefined, editedNote));
		await act(async () => {
			await client.invalidateQueries({ queryKey: publishedNoteKeys.all });
		});
		await waitFor(() => expect(result.current.notes).toEqual([editedNote]));
	});
});

describe("usePublishedNotesFeed", () => {
	it("首页请求失败后可以重试并读取手记", async () => {
		mockGet.mockRejectedValueOnce(new Error("boom"));
		const { result } = renderHook(() => usePublishedNotesFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		mockGet.mockResolvedValueOnce(page(undefined, note("n1")));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.notes).toEqual([note("n1")]));
	});

	it("loadMore 按上一页游标取下一页，失败可重试且不重复条目", async () => {
		mockGet.mockResolvedValueOnce(page("c1", note("n1")));
		const { result } = renderHook(() => usePublishedNotesFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.notes).toEqual([note("n1")]));
		expect(result.current.hasMore).toBe(true);
		mockGet.mockRejectedValueOnce(new Error("boom"));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
		expect(result.current.notes).toEqual([note("n1")]);
		mockGet.mockResolvedValueOnce(page(undefined, note("n1"), note("n2")));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.notes).toEqual([note("n1"), note("n2")]));
		expect(mockGet).toHaveBeenLastCalledWith(
			"/notes",
			expect.objectContaining({ params: { limit: 20, cursor: "c1" } }),
		);
		expect(result.current.hasMore).toBe(false);
	});

	it("切换筛选后不沿用旧游标，返回之前的筛选也从首页继续", async () => {
		mockGet.mockResolvedValueOnce(page("c1", note("n1")));
		const { result, rerender } = renderHook(
			({ tag }: { tag?: string }) => usePublishedNotesFeed({ limit: 20, tag }),
			{ initialProps: {}, wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.notes).toEqual([note("n1")]));
		mockGet.mockResolvedValueOnce(page(undefined, note("n2")));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.notes).toEqual([note("n1"), note("n2")]));

		mockGet.mockResolvedValueOnce(page(undefined, note("n3")));
		rerender({ tag: "redis" });
		await waitFor(() => expect(result.current.notes).toEqual([note("n3")]));
		expect(mockGet).toHaveBeenLastCalledWith(
			"/notes",
			expect.objectContaining({ params: { limit: 20, tag: "redis" } }),
		);

		rerender({});
		expect(result.current.notes).toEqual([note("n1")]);
	});
});
