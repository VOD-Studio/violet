import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import { apiDelete, apiGetPaged, apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { TweetCommentListCache } from "../comment-cache";
import { tweetKeys } from "../keys";
import { useCreateTweetComment, useDeleteTweetComment } from "../mutations";
import { useTweetComments } from "../queries";

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiDelete: vi.fn(),
}));

const author = { id: "u1", username: "alice", avatar_url: "" };
function comment(id: string): TweetComment {
	return {
		id,
		tweet_id: "t1",
		author,
		body: id,
		pictures: [],
		depth: 0,
		replies_count: 0,
		created_at: "2026-11-12T00:00:00Z",
	};
}
function cache(comments: TweetComment[]): TweetCommentListCache {
	return {
		pages: [
			{
				data: comments,
				pagination: { page: 1, limit: 10, total: comments.length, total_pages: 1 },
			},
		],
		pageParams: [1],
	};
}
function wrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("创建顶层评论更新两种排序，hot 保留 pending 直到后端权威排序返回", async () => {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	});
	qc.setQueryData(tweetKeys.commentListOf("t1", "latest"), cache([comment("old")]));
	qc.setQueryData(tweetKeys.commentListOf("t1", "hot"), cache([comment("old")]));
	const refresh = Promise.withResolvers<TweetCommentListCache["pages"][number]>();
	vi.mocked(apiGetPaged).mockReturnValue(refresh.promise);
	vi.mocked(apiPost).mockResolvedValue(comment("new"));
	const { result } = renderHook(
		() => {
			const hot = useTweetComments("t1", "hot");
			const create = useCreateTweetComment("t1");
			return { hot, create };
		},
		{ wrapper: wrapper(qc) },
	);
	act(() => result.current.create.mutate({ body: "new" }));
	await waitFor(() =>
		expect(apiGetPaged).toHaveBeenCalledWith("/tweets/t1/comments", {
			params: { page: 1, limit: 10, sort: "hot" },
		}),
	);
	expect(result.current.create.isPending).toBe(true);
	expect(
		qc
			.getQueryData<TweetCommentListCache>(tweetKeys.commentListOf("t1", "latest"))
			?.pages[0].data.map((item) => item.id),
	).toEqual(["new", "old"]);
	await act(async () => refresh.resolve(cache([comment("old"), comment("new")]).pages[0]));
	await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
	expect(result.current.hot.data?.pages[0].data.map((item) => item.id)).toEqual(["old", "new"]);
	cleanup();
	qc.clear();
});

it("删除失败原位恢复目标，不复活其它成功删除或抹掉并发新增，两种排序均保留", async () => {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Infinity },
			mutations: { retry: false },
		},
	});
	for (const sort of ["latest", "hot"] as const) {
		qc.setQueryData(
			tweetKeys.commentListOf("t1", sort),
			cache([comment("a"), comment("b"), comment("c")]),
		);
	}
	const tweet: Tweet = {
		id: "t1",
		author,
		content: "推文",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 3,
		quote_count: 0,
		link_cards: [],
		created_at: "2026-11-12T00:00:00Z",
	};
	qc.setQueryData(tweetKeys.detail("t1"), tweet);
	const firstDelete = Promise.withResolvers<null>();
	vi.mocked(apiDelete).mockImplementation((path) => {
		if (path.endsWith("/b")) {
			return firstDelete.promise as never;
		}
		return Promise.resolve(null) as never;
	});
	vi.mocked(apiPost).mockResolvedValue(comment("new"));
	const { result } = renderHook(
		() => ({
			first: useDeleteTweetComment("t1"),
			second: useDeleteTweetComment("t1"),
			create: useCreateTweetComment("t1"),
		}),
		{ wrapper: wrapper(qc) },
	);
	act(() => result.current.first.mutate("b"));
	await waitFor(() =>
		expect(
			qc
				.getQueryData<TweetCommentListCache>(tweetKeys.commentListOf("t1", "latest"))
				?.pages[0].data.map((item) => item.id),
		).toEqual(["a", "c"]),
	);
	act(() => result.current.second.mutate("a"));
	await waitFor(() => expect(result.current.second.isSuccess).toBe(true));
	act(() => result.current.create.mutate({ body: "new" }));
	await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
	await act(async () => firstDelete.reject(new Error("禁止删除")));
	await waitFor(() => expect(result.current.first.isError).toBe(true));
	for (const sort of ["latest", "hot"] as const) {
		const current = qc.getQueryData<TweetCommentListCache>(tweetKeys.commentListOf("t1", sort));
		expect(current?.pages[0].data.map((item) => item.id)).toEqual(["new", "b", "c"]);
		expect(current?.pages[0].pagination.total).toBe(3);
	}
	expect(qc.getQueryData<Tweet>(tweetKeys.detail("t1"))?.comment_count).toBe(3);
	cleanup();
	qc.clear();
});
