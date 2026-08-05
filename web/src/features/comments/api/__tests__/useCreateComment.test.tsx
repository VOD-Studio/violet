/**
 * useCreateComment mutation 缓存行为测试
 *
 * 验证提交回复后缓存是否正确更新——不触发列表重拉（避免批注 relocate 重算）。
 */
import type { Comment } from "@entities/comment/model/types";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGetPaged: vi.fn(),
	apiGet: vi.fn(),
	apiDelete: vi.fn(),
	apiPatch: vi.fn(),
}));

import { apiGetPaged, apiPost } from "@shared/api/request";
import { commentKeys } from "../keys";
import { useCreateComment } from "../mutations";
import { useComments } from "../queries";

function createWrapper(qc: QueryClient) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ({ children }: any) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
	return {
		id: "c1",
		post_id: "p1",
		depth: 0,
		author_name: "Alice",
		avatar_url: "",
		body: "Top-level comment",
		pictures: [],
		is_author: false,
		status: "approved",
		created_at: "2026-01-01T00:00:00Z",
		replies_total: 0,
		replies: [],
		...overrides,
	};
}

describe("useCreateComment — 回复缓存更新", () => {
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

	it("提交回复后 replies_total 递增且不触发列表重拉", async () => {
		const topComment = makeComment({ id: "c1", replies_total: 2, replies: [] });
		const initialList: PagedResponse<Comment> = {
			data: [topComment],
			pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
		};
		qc.setQueryData(commentKeys.list("p1", { type: "free" }), initialList);

		vi.mocked(apiPost).mockResolvedValue(
			makeComment({
				id: "r-new",
				parent_id: "c1",
				depth: 1,
				body: "My new reply",
				replies_total: undefined,
				replies: undefined,
				status: "pending",
			}),
		);

		const { result } = renderHook(
			() => ({
				comments: useComments("p1", { type: "free" }),
				create: useCreateComment("p1"),
			}),
			{ wrapper: createWrapper(qc) },
		);

		expect(result.current.comments.data?.data[0].replies_total).toBe(2);

		await result.current.create.mutateAsync({ body: "My new reply", parent_id: "c1" });

		await waitFor(() => {
			expect(result.current.comments.data?.data[0].replies_total).toBe(3);
		});

		// 不应触发列表重拉
		expect(vi.mocked(apiGetPaged)).not.toHaveBeenCalled();
	});

	it("已展开回复区时提交回复，useReplies 缓存应含新回复", async () => {
		const topComment = makeComment({ id: "c1", replies_total: 1, replies: [] });
		const listData: PagedResponse<Comment> = {
			data: [topComment],
			pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
		};
		qc.setQueryData(commentKeys.list("p1", { type: "free" }), listData);

		const existingReply = makeComment({
			id: "r1",
			parent_id: "c1",
			depth: 1,
			body: "Existing reply",
			replies_total: undefined,
			replies: undefined,
		});
		const repliesData = {
			pages: [
				{
					data: [existingReply],
					pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
				},
			] as PagedResponse<Comment>[],
			pageParams: [1],
		};
		qc.setQueryData(commentKeys.replyList("c1", { limit: 10 }), repliesData);

		vi.mocked(apiPost).mockResolvedValue(
			makeComment({
				id: "r-new",
				parent_id: "c1",
				depth: 1,
				body: "Second reply",
				replies_total: undefined,
				replies: undefined,
				status: "pending",
			}),
		);

		const { result } = renderHook(() => useCreateComment("p1"), {
			wrapper: createWrapper(qc),
		});

		await result.current.mutateAsync({ body: "Second reply", parent_id: "c1" });

		await waitFor(() => {
			const cache = qc.getQueryData<{
				pages: PagedResponse<Comment>[];
				pageParams: number[];
			}>(commentKeys.replyList("c1", { limit: 10 }));
			const allReplies = cache?.pages.flatMap((p) => p.data) ?? [];
			expect(allReplies.some((r) => r.id === "r-new")).toBe(true);
		});
	});
});
