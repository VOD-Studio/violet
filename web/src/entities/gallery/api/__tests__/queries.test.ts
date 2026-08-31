import { apiGet, apiGetPaged } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchPublishedGalleries,
	fetchPublishedGallery,
	usePublishedGalleryFeed,
} from "../queries";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
}));

describe("published gallery queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("按游标读取公开列表", async () => {
		vi.mocked(apiGetPaged).mockResolvedValue({
			data: [],
			pagination: { limit: 12 },
		});

		await fetchPublishedGalleries({ cursor: "next/item", limit: 12 });

		expect(apiGetPaged).toHaveBeenCalledWith("/galleries", {
			params: { cursor: "next/item", limit: 12 },
		});
	});

	it("编码 slug 后读取公开详情", async () => {
		vi.mocked(apiGet).mockResolvedValue({});

		await fetchPublishedGallery("夏日/微光");

		expect(apiGet).toHaveBeenCalledWith("/galleries/%E5%A4%8F%E6%97%A5%2F%E5%BE%AE%E5%85%89");
	});

	it("下一游标失败后可重试同一页并合并结果", async () => {
		const firstGallery = {
			id: "gallery-1",
			slug: "first",
			title: "第一页",
			summary: "",
			published_at: "2026-08-31T00:00:00Z",
			items: [],
		};
		const secondGallery = { ...firstGallery, id: "gallery-2", slug: "second", title: "第二页" };
		let nextAttempts = 0;
		vi.mocked(apiGetPaged).mockImplementation((_url, config) => {
			const cursor = (config?.params as { cursor?: string } | undefined)?.cursor;
			if (!cursor) {
				return Promise.resolve({
					data: [firstGallery],
					pagination: { limit: 1, has_more: true, next_cursor: "cursor-2" },
				});
			}
			nextAttempts += 1;
			if (nextAttempts === 1) return Promise.reject(new Error("temporary failure"));
			return Promise.resolve({ data: [secondGallery], pagination: { limit: 1 } });
		});
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { result } = renderHook(() => usePublishedGalleryFeed(1), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(QueryClientProvider, { client: queryClient }, children),
		});

		await waitFor(() => expect(result.current.galleries).toHaveLength(1));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
		act(() => result.current.loadMore());

		await waitFor(() => expect(result.current.galleries).toHaveLength(2));
		expect(nextAttempts).toBe(2);
		expect(result.current.galleries.map((gallery) => gallery.slug)).toEqual([
			"first",
			"second",
		]);
	});
});
