import type { Tweet } from "@entities/tweet/model/types";
import { apiDelete, apiGet, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiGetPaged: vi.fn(),
}));
vi.mock("@shared/api/csrf", () => ({ getCSRFToken: () => "" }));

import { tweetKeys } from "../keys";
import { useCreateTweet, useDeleteTweet, useToggleLikeTweet } from "../mutations";
import type { TweetTimelineCache } from "../timeline-cache";
import { useRecordTweetView } from "../useRecordTweetView";

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
		view_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		link_cards: [],
		...overrides,
	};
}

function paged<T>(data: T[]): PagedResponse<T> {
	return {
		data,
		pagination: { page: 1, limit: 20, total: data.length, total_pages: 1 },
	};
}

describe("推文写入后的时间线缓存", () => {
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
		const hot = tweetKeys.timelineOf(20, "hot");
		const topic = tweetKeys.topicTimelineOf("开发");
		const user = tweetKeys.userTimelineOf("alice");
		for (const key of [hot, topic, user]) {
			qc.setQueryData(key, { pages: [paged([target, other])], pageParams: [undefined] });
		}
		qc.setQueryData(tweetKeys.sidebar, { authors: [], topics: [], images: [] });

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
		for (const key of [hot, topic, user]) {
			expect(qc.getQueryData<TweetTimelineCache>(key)?.pages[0].data).toEqual([other]);
		}
		expect(qc.getQueryState(tweetKeys.sidebar)?.isInvalidated).toBe(true);
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

	it("发布纯文本只前插最新；发布带图推文也更新有图，重复发布结果不会重叠", async () => {
		const other = makeTweet({
			id: "existing",
			images: [{ url: "/existing", width: null, height: null }],
		});
		const text = makeTweet({ id: "new-text" });
		const photo = makeTweet({
			id: "new-photo",
			images: [{ url: "/new", width: null, height: null }],
		});
		const latestKey = tweetKeys.timelineOf();
		const imagesKey = tweetKeys.timelineOf(20, "images");
		const hotKey = tweetKeys.timelineOf(20, "hot");
		for (const key of [latestKey, imagesKey, hotKey]) {
			qc.setQueryData(key, { pages: [paged([other])], pageParams: [undefined] });
		}
		qc.setQueryData(tweetKeys.sidebar, { authors: [], topics: [], images: [] });
		vi.mocked(apiPost)
			.mockResolvedValueOnce(text)
			.mockResolvedValueOnce(photo)
			.mockResolvedValueOnce(photo);
		const { result } = renderHook(useCreateTweet, { wrapper: createWrapper(qc) });
		const firstPage = (key: typeof latestKey) =>
			qc.getQueryData<TweetTimelineCache>(key)?.pages[0].data;

		await act(() => result.current.mutateAsync({ content: text.content, images: [] }));
		expect(firstPage(latestKey)).toEqual([text, other]);
		expect(firstPage(imagesKey)).toEqual([other]);

		const imageInput = { content: photo.content, images: ["/new"] };
		await act(() => result.current.mutateAsync(imageInput));
		await act(() => result.current.mutateAsync(imageInput));
		expect(firstPage(latestKey)).toEqual([photo, text, other]);
		expect(firstPage(imagesKey)).toEqual([photo, other]);
		expect(firstPage(hotKey)).toEqual([other]);
		expect(qc.getQueryState(hotKey)?.isInvalidated).toBe(true);
		expect(qc.getQueryState(tweetKeys.sidebar)?.isInvalidated).toBe(true);
	});

	it("只有启用的详情记录浏览，StrictMode 不双写；点赞失败不回滚浏览量", async () => {
		const tweet = makeTweet({ view_count: 3 });
		const detail = tweetKeys.detail(tweet.id);
		const keys = [
			tweetKeys.timelineOf(20, "latest"),
			tweetKeys.timelineOf(20, "hot"),
			tweetKeys.timelineOf(20, "images"),
			tweetKeys.topicTimelineOf("开发"),
			tweetKeys.userTimelineOf("alice"),
		];
		qc.setQueryData(detail, tweet);
		for (const key of keys) {
			qc.setQueryData(key, { pages: [paged([tweet])], pageParams: [undefined] });
		}
		const { promise: liking, reject: rejectLike } = Promise.withResolvers<never>();
		vi.mocked(apiPost).mockImplementation((path) =>
			path.endsWith("/like") ? liking : Promise.resolve({ view_count: 12 }),
		);
		vi.mocked(apiGet).mockResolvedValue({ csrf_token: "visitor-token" });

		const { result: like } = renderHook(() => useToggleLikeTweet(tweet), {
			wrapper: createWrapper(qc),
		});
		like.current.mutate();
		await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
		expect(qc.getQueryData<Tweet>(detail)?.like_count).toBe(1);

		const disabled = renderHook(() => useRecordTweetView(tweet.id, false), {
			wrapper: createWrapper(qc),
		});
		expect(apiPost).toHaveBeenCalledTimes(1);
		disabled.unmount();

		const view = renderHook(() => useRecordTweetView(tweet.id, true), {
			wrapper: ({ children }) => (
				<StrictMode>
					<QueryClientProvider client={qc}>{children}</QueryClientProvider>
				</StrictMode>
			),
		});
		await waitFor(() => expect(qc.getQueryData<Tweet>(detail)?.view_count).toBe(12));
		view.rerender();
		expect(apiPost).toHaveBeenCalledTimes(2);
		expect(apiPost).toHaveBeenLastCalledWith(`/tweets/${tweet.id}/views`);
		expect(apiGet).toHaveBeenCalledExactlyOnceWith("/auth/csrf-token");
		expect(vi.mocked(apiGet).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(apiPost).mock.invocationCallOrder[1],
		);

		rejectLike(new Error("点赞失败"));
		await waitFor(() => expect(like.current.isError).toBe(true));
		expect(qc.getQueryData<Tweet>(detail)).toMatchObject({
			view_count: 12,
			like_count: 0,
			is_liked: false,
		});
		for (const key of keys) {
			expect(qc.getQueryData<TweetTimelineCache>(key)?.pages[0].data[0]).toMatchObject({
				view_count: 12,
				like_count: 0,
				is_liked: false,
			});
		}
	});
});
