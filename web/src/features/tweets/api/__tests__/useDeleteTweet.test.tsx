/**
 * useDeleteTweet mutation 缓存联动测试
 *
 * 验证删除成功后：
 *   - 全局时间线各页移除该推文（不限 limit 维度）
 *   - 该推文详情缓存被移除（详情页删除后不可再访问）
 *   - 时间线 updater 不会误伤详情缓存（detail key 与 timeline 前缀不重叠）
 *
 * 范式参考 comments/api/__tests__/useCreateComment.test.tsx。
 */
import type { Tweet } from "@entities/tweet/model/types";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiGetPaged: vi.fn(),
}));

import { apiDelete } from "@shared/api/request";
import { tweetKeys } from "../keys";
import { useDeleteTweet } from "../mutations";

function createWrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author: { id: "u1", username: "alice", avatar_url: "" },
		content: "hello",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

function paged<T>(data: T[]): PagedResponse<T> {
	return {
		data,
		pagination: { page: 1, limit: 20, total: data.length, total_pages: 1 },
	};
}

describe("useDeleteTweet — 缓存联动", () => {
	let qc: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		qc = new QueryClient({
			defaultOptions: {
				queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
				mutations: { retry: false },
			},
		});
	});

	afterEach(() => {
		qc.clear();
	});

	it("删除后从时间线各页移除该推文并清空详情缓存", async () => {
		const target = makeTweet({ id: "t-target" });
		const other = makeTweet({ id: "t-other" });
		// 模拟跨页：首页与第二页都含目标推文
		qc.setQueryData(tweetKeys.timelineOf(20), {
			pages: [paged([target, other]), paged([target])],
			pageParams: [undefined, "cursor-1"],
		});
		qc.setQueryData(tweetKeys.detail("t-target"), target);

		vi.mocked(apiDelete).mockResolvedValue(null);

		const { result } = renderHook(() => useDeleteTweet("t-target"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate();

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		const timeline = qc.getQueryData<{
			pages: PagedResponse<Tweet>[];
			pageParams: (string | undefined)[];
		}>(tweetKeys.timelineOf(20));
		expect(timeline?.pages[0].data).toEqual([other]);
		expect(timeline?.pages[1].data).toEqual([]);
		// 详情缓存已移除
		expect(qc.getQueryData(tweetKeys.detail("t-target"))).toBeUndefined();
	});

	it("不影响其他 limit 维度的时间线缓存结构（仅过滤目标）", async () => {
		const target = makeTweet({ id: "t-target" });
		const other = makeTweet({ id: "t-other" });
		qc.setQueryData(tweetKeys.timelineOf(10), {
			pages: [paged([target, other])],
			pageParams: [undefined],
		});

		vi.mocked(apiDelete).mockResolvedValue(null);

		const { result } = renderHook(() => useDeleteTweet("t-target"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate();

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		const timeline = qc.getQueryData<{
			pages: PagedResponse<Tweet>[];
		}>(tweetKeys.timelineOf(10));
		expect(timeline?.pages[0].data).toEqual([other]);
	});

	it("时间线无缓存时删除仍成功（setQueriesData 为 no-op）", async () => {
		vi.mocked(apiDelete).mockResolvedValue(null);

		const { result } = renderHook(() => useDeleteTweet("t-gone"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate();

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		// 不抛错即通过
		expect(apiDelete).toHaveBeenCalledWith("/tweets/t-gone");
	});
});
