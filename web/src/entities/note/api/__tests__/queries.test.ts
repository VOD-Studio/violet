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
	it("透传游标、上限与标签参数", async () => {
		mockGetPaged.mockResolvedValue(page(undefined) as never);
		const { result } = renderHook(
			() => usePublishedNotes({ limit: 20, tag: "redis", cursor: "abc" }),
			{ wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockGetPaged).toHaveBeenCalledWith("/notes", {
			params: { limit: 20, tag: "redis", cursor: "abc" },
		});
	});
});

describe("usePublishedNotesFeed", () => {
	it("首页失败后重试仍请求同一 query", async () => {
		mockGetPaged.mockRejectedValueOnce(new Error("boom") as never);
		const { result } = renderHook(() => usePublishedNotesFeed(20), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		mockGetPaged.mockResolvedValue(page(undefined) as never);
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.isError).toBe(false));
	});

	it("loadMore 按上一页游标取下一页并合并条目", async () => {
		mockGetPaged.mockResolvedValueOnce(page("c1", { id: "n1" }) as never);
		const { result } = renderHook(() => usePublishedNotesFeed(20), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.notes).toHaveLength(1));
		expect(result.current.hasMore).toBe(true);

		mockGetPaged.mockResolvedValueOnce(page(undefined, { id: "n2" }) as never);
		await act(async () => {
			result.current.loadMore();
		});
		await waitFor(() => expect(result.current.notes).toHaveLength(2));
		expect(mockGetPaged).toHaveBeenLastCalledWith("/notes", {
			params: { limit: 20, cursor: "c1", tag: undefined },
		});
		expect(result.current.hasMore).toBe(false);
	});
});
