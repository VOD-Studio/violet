import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublishedNotes, usePublishedNotesFeed } from "../queries";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
}));

import { apiGetPaged } from "@shared/api/request";

const mockGetPaged = vi.mocked(apiGetPaged);

function page(next_cursor: string | undefined, ...data: unknown[]) {
	return { data, pagination: next_cursor ? { next_cursor } : {} };
}

function createWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	mockGetPaged.mockReset();
});

describe("fetchPublishedNotes", () => {
	it("透传游标、上限、标签、类型与项目参数", async () => {
		mockGetPaged.mockResolvedValue(page(undefined) as never);
		const { result } = renderHook(
			() =>
				usePublishedNotes({
					limit: 20,
					tag: "redis",
					type: "pitfall",
					project_id: "0e9bc14a-3588-4dc1-9862-02562b6d6ee0",
					cursor: "abc",
				}),
			{ wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockGetPaged).toHaveBeenCalledWith("/notes", {
			params: {
				limit: 20,
				tag: "redis",
				type: "pitfall",
				project_id: "0e9bc14a-3588-4dc1-9862-02562b6d6ee0",
				cursor: "abc",
			},
		});
	});
});

describe("usePublishedNotesFeed", () => {
	it("首页失败后重试仍请求同一 query", async () => {
		mockGetPaged.mockRejectedValueOnce(new Error("boom") as never);
		const { result } = renderHook(() => usePublishedNotesFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		mockGetPaged.mockResolvedValue(page(undefined) as never);
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.isError).toBe(false));
	});

	it("loadMore 按上一页游标取下一页，失败可重试且不重复条目", async () => {
		mockGetPaged.mockResolvedValueOnce(page("c1", { id: "n1" }) as never);
		const { result } = renderHook(() => usePublishedNotesFeed({ limit: 20 }), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.notes).toHaveLength(1));
		expect(result.current.hasMore).toBe(true);
		mockGetPaged.mockRejectedValueOnce(new Error("boom"));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
		mockGetPaged.mockResolvedValueOnce(page(undefined, { id: "n1" }, { id: "n2" }) as never);
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.notes).toEqual([{ id: "n1" }, { id: "n2" }]));
		expect(mockGetPaged).toHaveBeenLastCalledWith("/notes", {
			params: { limit: 20, cursor: "c1" },
		});
		expect(result.current.hasMore).toBe(false);
	});

	it("切换筛选后不沿用旧游标，返回之前的筛选也从首页继续", async () => {
		mockGetPaged.mockResolvedValueOnce(page("c1", { id: "n1" }) as never);
		const { result, rerender } = renderHook(
			({ tag }: { tag?: string }) => usePublishedNotesFeed({ limit: 20, tag }),
			{ initialProps: {}, wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.notes).toHaveLength(1));
		mockGetPaged.mockResolvedValueOnce(page(undefined, { id: "n2" }) as never);
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.notes).toHaveLength(2));

		mockGetPaged.mockResolvedValueOnce(page(undefined, { id: "n3" }) as never);
		rerender({ tag: "redis" });
		await waitFor(() => expect(result.current.notes).toEqual([{ id: "n3" }]));
		expect(mockGetPaged).toHaveBeenLastCalledWith("/notes", {
			params: { limit: 20, tag: "redis" },
		});

		rerender({});
		expect(result.current.notes).toEqual([{ id: "n1" }]);
	});
});
