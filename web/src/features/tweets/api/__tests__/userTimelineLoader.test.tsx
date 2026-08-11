import type { Tweet } from "@entities/tweet/model/types";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
}));

import { apiGetPaged } from "@shared/api/request";
import { tweetKeys } from "../keys";
import { fetchUserTimeline, useUserTimeline } from "../queries";

function createWrapper(qc: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

describe("userTimeline loader prefetching compatibility", () => {
	it("reproduces TypeError when userTimeline is prefetched with ensureQueryData instead of ensureInfiniteQueryData", async () => {
		const qc = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});

		const mockResponse: PagedResponse<Tweet> = {
			data: [
				{
					id: "t1",
					author: { id: "u1", username: "大鸟哥", avatar_url: "" },
					content: "Hello world",
					images: [],
					like_count: 0,
					comment_count: 0,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-01T00:00:00Z",
				},
			],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGetPaged).mockResolvedValue(mockResponse);

		// Simulate $username.tsx loader bug: prefetching infinite query key with ensureQueryData
		await qc.ensureQueryData({
			queryKey: tweetKeys.userTimelineOf("大鸟哥"),
			queryFn: () => fetchUserTimeline("大鸟哥"),
		});

		// Rendering useUserTimeline hook when cache contains raw PagedResponse instead of InfiniteData
		expect(() => {
			renderHook(() => useUserTimeline("大鸟哥"), {
				wrapper: createWrapper(qc),
			});
		}).toThrow("Cannot read properties of undefined (reading 'length')");
	});

	it("succeeds when userTimeline is prefetched with ensureInfiniteQueryData", async () => {
		const qc = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});

		const mockResponse: PagedResponse<Tweet> = {
			data: [
				{
					id: "t1",
					author: { id: "u1", username: "大鸟哥", avatar_url: "" },
					content: "Hello world",
					images: [],
					like_count: 0,
					comment_count: 0,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-01T00:00:00Z",
				},
			],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGetPaged).mockResolvedValue(mockResponse);

		await qc.ensureInfiniteQueryData({
			queryKey: tweetKeys.userTimelineOf("大鸟哥"),
			queryFn: ({ pageParam }) => fetchUserTimeline("大鸟哥", { cursor: pageParam }),
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (lastPage: PagedResponse<Tweet>) =>
				lastPage.pagination?.next_cursor || undefined,
		});

		const { result } = renderHook(() => useUserTimeline("大鸟哥"), {
			wrapper: createWrapper(qc),
		});

		expect(result.current.data?.pages[0].data).toHaveLength(1);
		expect(result.current.data?.pages[0].data[0].content).toBe("Hello world");
	});
});
