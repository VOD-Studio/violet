import type { JournalEntry, JournalPage, JournalQuery } from "@entities/note/model/types";
import { apiGet } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishedNoteKeys } from "../keys";
import { journalQueryOptions, useJournalFeed } from "../queries";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
}));

const mockGet = vi.mocked(apiGet);

function note(id: string): JournalEntry {
	return {
		kind: "note",
		note: {
			id,
			title: id,
			content_html: "",
			tags: [],
			published_at: "2026-09-02T10:00:00Z",
			type: "unclassified",
			project: null,
			pitfall: null,
		},
	};
}

function page(next_cursor: string | null, ...entries: JournalEntry[]): JournalPage {
	return { entries, next_cursor, progress: null };
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

describe("journalQueryOptions", () => {
	it("服务端首屏和浏览器共享混合时间线缓存，手写变更能使该缓存失效", async () => {
		const query: JournalQuery = {
			limit: 24,
			type: "progress",
			project_id: "0e9bc14a-3588-4dc1-9862-02562b6d6ee0",
		};
		mockGet.mockResolvedValueOnce(page(null));
		const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
		await client.ensureQueryData(journalQueryOptions(query));
		const { result } = renderHook(() => useJournalFeed(query), {
			wrapper: createWrapper(client),
		});
		expect(result.current.isLoading).toBe(false);
		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet).toHaveBeenCalledWith(
			"/journal",
			expect.objectContaining({ params: query }),
		);

		mockGet.mockResolvedValueOnce(page(null));
		await act(async () => {
			await client.invalidateQueries({ queryKey: publishedNoteKeys.all });
		});
		expect(mockGet).toHaveBeenCalledTimes(2);
	});
});

describe("useJournalFeed", () => {
	it("首页失败后重试仍请求同一 query", async () => {
		mockGet.mockRejectedValueOnce(new Error("boom"));
		const { result } = renderHook(() => useJournalFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		mockGet.mockResolvedValue(page(null));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.isError).toBe(false));
	});

	it("loadMore 按上一页游标取下一页，失败可重试且不重复条目", async () => {
		mockGet.mockResolvedValueOnce(page("c1", note("n1")));
		const { result } = renderHook(() => useJournalFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.entries).toHaveLength(1));
		expect(result.current.hasMore).toBe(true);
		mockGet.mockRejectedValueOnce(new Error("boom"));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
		mockGet.mockResolvedValueOnce(page(null, note("n1"), note("n2")));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.entries).toEqual([note("n1"), note("n2")]));
		expect(mockGet).toHaveBeenLastCalledWith(
			"/journal",
			expect.objectContaining({ params: { limit: 20, cursor: "c1" } }),
		);
		expect(result.current.hasMore).toBe(false);
	});

	it("切换筛选后不沿用旧游标，返回之前的筛选也从首页继续", async () => {
		mockGet.mockResolvedValueOnce(page("c1", note("n1")));
		const { result, rerender } = renderHook(
			({ tag }: { tag?: string }) => useJournalFeed({ limit: 20, tag }),
			{ initialProps: {}, wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.entries).toHaveLength(1));
		mockGet.mockResolvedValueOnce(page(null, note("n2")));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.entries).toHaveLength(2));

		mockGet.mockResolvedValueOnce(page(null, note("n3")));
		rerender({ tag: "redis" });
		await waitFor(() => expect(result.current.entries).toEqual([note("n3")]));
		expect(mockGet).toHaveBeenLastCalledWith(
			"/journal",
			expect.objectContaining({ params: { limit: 20, tag: "redis" } }),
		);

		rerender({});
		expect(result.current.entries).toEqual([note("n1")]);
	});
});
