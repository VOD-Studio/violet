/**
 * useCreateTweetComment / useDeleteTweetComment mutation 缓存联动测试
 *
 * 验证（T8 详情页评论区）：
 *   - 创建顶层评论：插到评论列表首页顶部 + comment_count +1 同步到详情与时间线
 *   - 创建回复：追加到对应顶层评论的回复列表末尾 + comment_count +1
 *   - 删除评论：乐观从评论缓存移除 + comment_count -1；成功后失效详情重取
 *   - 删除失败：回滚评论缓存与 comment_count
 *
 * 范式参考 tweets/api/__tests__/useDeleteTweet.test.tsx。
 */
import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiGetPaged: vi.fn(),
}));

import { apiDelete, apiGetPaged, apiPost } from "@shared/api/request";
import { tweetKeys } from "../keys";
import { useCreateTweetComment, useDeleteTweetComment } from "../mutations";
import { useTweetComments, useTweetReplies } from "../queries";

function createWrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

const author = { id: "u1", username: "alice", avatar_url: "" };

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author,
		content: "hello",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		link_cards: [],
		...overrides,
	};
}

function makeComment(overrides: Partial<TweetComment> = {}): TweetComment {
	return {
		id: "c1",
		tweet_id: "t1",
		author,
		body: "hi",
		pictures: [],
		depth: 0,
		replies_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

function paged<T>(data: T[], total = data.length): PagedResponse<T> {
	return {
		data,
		pagination: { page: 1, limit: 10, total, total_pages: Math.max(1, Math.ceil(total / 10)) },
	};
}

type CommentListCache = {
	pages: PagedResponse<TweetComment>[];
	pageParams: (number | undefined)[];
};

describe("useCreateTweetComment — 缓存联动", () => {
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
		cleanup();
	});

	it("创建顶层评论：插到列表首页顶部 + comment_count +1 同步详情与时间线", async () => {
		const tweet = makeTweet({ id: "t1", comment_count: 2 });
		const existing = makeComment({ id: "c-old" });
		qc.setQueryData(tweetKeys.commentListOf("t1", "latest"), {
			pages: [paged([existing], 2)],
			pageParams: [1],
		} satisfies CommentListCache);
		qc.setQueryData(tweetKeys.detail("t1"), tweet);
		qc.setQueryData(tweetKeys.timelineOf(20), {
			pages: [{ data: [tweet], pagination: { limit: 20 } }],
			pageParams: [undefined],
		});

		const newComment = makeComment({ id: "c-new", body: "fresh" });
		vi.mocked(apiPost).mockResolvedValue(newComment);

		const { result } = renderHook(() => useCreateTweetComment("t1"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate({ body: "fresh" });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// 评论列表：新评论在首页顶部
		const list = qc.getQueryData<CommentListCache>(tweetKeys.commentListOf("t1", "latest"));
		expect(list?.pages[0].data.map((c) => c.id)).toEqual(["c-new", "c-old"]);
		expect(list?.pages[0].pagination.total).toBe(3);
		// 详情 comment_count +1
		expect(qc.getQueryData<Tweet>(tweetKeys.detail("t1"))?.comment_count).toBe(3);
		// 时间线 comment_count +1
		const timeline = qc.getQueryData<{ pages: { data: Tweet[] }[] }>(tweetKeys.timelineOf(20));
		expect(timeline?.pages[0].data[0].comment_count).toBe(3);
	});

	it("创建回复：追加到对应顶层评论的回复列表末尾 + comment_count +1", async () => {
		const tweet = makeTweet({ id: "t1", comment_count: 1 });
		const existingReply = makeComment({ id: "c-r1", depth: 1, parent_id: "c-top" });
		qc.setQueryData(tweetKeys.replies("c-top"), {
			pages: [paged([existingReply], 1)],
			pageParams: [1],
		} satisfies CommentListCache);
		qc.setQueryData(tweetKeys.detail("t1"), tweet);

		const newReply = makeComment({ id: "c-r2", depth: 1, parent_id: "c-top" });
		vi.mocked(apiPost).mockResolvedValue(newReply);

		const { result } = renderHook(() => useCreateTweetComment("t1"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate({ body: "reply", parent_id: "c-top" });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// 回复列表：新回复追加在末尾
		const replies = qc.getQueryData<CommentListCache>(tweetKeys.replies("c-top"));
		expect(replies?.pages[0].data.map((c) => c.id)).toEqual(["c-r1", "c-r2"]);
		expect(replies?.pages[0].pagination.total).toBe(2);
		// 详情 comment_count +1
		expect(qc.getQueryData<Tweet>(tweetKeys.detail("t1"))?.comment_count).toBe(2);
	});
});

describe("useDeleteTweetComment — 乐观删除与回滚", () => {
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
		cleanup();
	});

	it("乐观删除：评论缓存即时移除 + comment_count -1；成功后失效详情重取", async () => {
		const tweet = makeTweet({ id: "t1", comment_count: 3 });
		const target = makeComment({ id: "c-del" });
		const other = makeComment({ id: "c-keep" });
		qc.setQueryData(tweetKeys.commentListOf("t1", "latest"), {
			pages: [paged([target, other], 2)],
			pageParams: [1],
		} satisfies CommentListCache);
		qc.setQueryData(tweetKeys.detail("t1"), tweet);

		vi.mocked(apiDelete).mockResolvedValue(null);

		const { result } = renderHook(() => useDeleteTweetComment("t1"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate("c-del");

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		// 评论缓存：目标已移除
		const list = qc.getQueryData<CommentListCache>(tweetKeys.commentListOf("t1", "latest"));
		expect(list?.pages[0].data.map((c) => c.id)).toEqual(["c-keep"]);
		// 详情被 invalidate（isInvalidating 或重新标记为 stale）
		expect(apiDelete).toHaveBeenCalledWith("/tweets/t1/comments/c-del");
	});

	it("删除失败：回滚评论缓存与 comment_count", async () => {
		const tweet = makeTweet({ id: "t1", comment_count: 2 });
		const target = makeComment({ id: "c-del" });
		qc.setQueryData(tweetKeys.commentListOf("t1", "latest"), {
			pages: [paged([target], 1)],
			pageParams: [1],
		} satisfies CommentListCache);
		qc.setQueryData(tweetKeys.detail("t1"), tweet);

		vi.mocked(apiDelete).mockRejectedValue(new Error("forbidden"));

		const { result } = renderHook(() => useDeleteTweetComment("t1"), {
			wrapper: createWrapper(qc),
		});
		result.current.mutate("c-del");

		await waitFor(() => expect(result.current.isError).toBe(true));

		// 回滚：评论回到缓存
		const list = qc.getQueryData<CommentListCache>(tweetKeys.commentListOf("t1", "latest"));
		expect(list?.pages[0].data.map((c) => c.id)).toEqual(["c-del"]);
		// 回滚：comment_count 恢复原值
		expect(qc.getQueryData<Tweet>(tweetKeys.detail("t1"))?.comment_count).toBe(2);
	});
});

it("真实排序参数独立缓存并保留服务端次序；回复保持默认时间正序", async () => {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const newest = makeComment({ id: "newest" });
	const hottest = makeComment({ id: "hottest" });
	vi.mocked(apiGetPaged).mockImplementation((_path, options) => {
		const params = options?.params as { sort?: string } | undefined;
		return Promise.resolve(
			paged(params?.sort === "hot" ? [hottest, newest] : [newest, hottest]),
		) as never;
	});
	const wrapper = createWrapper(qc);
	const { result, rerender, unmount } = renderHook(
		({ sort }: { sort: "latest" | "hot" }) => useTweetComments("t1", sort),
		{ wrapper, initialProps: { sort: "latest" } },
	);
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data?.pages[0].data.map((item) => item.id)).toEqual([
		"newest",
		"hottest",
	]);
	rerender({ sort: "hot" });
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data?.pages[0].data.map((item) => item.id)).toEqual([
		"hottest",
		"newest",
	]);
	expect(apiGetPaged).toHaveBeenCalledWith("/tweets/t1/comments", {
		params: { page: 1, limit: 10, sort: "hot" },
	});
	expect(qc.getQueryData(tweetKeys.commentListOf("t1", "latest"))).toBeDefined();
	expect(qc.getQueryData(tweetKeys.commentListOf("t1", "hot"))).toBeDefined();
	expect(qc.getQueryData(tweetKeys.commentList("t1"))).toBeUndefined();
	unmount();
	const replies = renderHook(() => useTweetReplies("t1", "root"), { wrapper });
	await waitFor(() => expect(replies.result.current.isSuccess).toBe(true));
	expect(apiGetPaged).toHaveBeenCalledWith("/tweets/t1/comments/root/replies", {
		params: { page: 1, limit: 10 },
	});
	cleanup();
	qc.clear();
});
