/**
 * useCreateComment mutation 缓存行为测试
 *
 * 验证提交回复后缓存是否正确更新——用户报「回复评论后没有显示，需刷新才出现」。
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

    it("未展开回复区时提交回复，顶层列表应失效重拉并刷新 replies_total", async () => {
        // --- 种入顶层评论列表缓存（模拟页面已加载，replies_total=2） ---
        const topComment = makeComment({ id: "c1", replies_total: 2, replies: [] });
        const initialList: PagedResponse<Comment> = {
            data: [topComment],
            pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        };
        qc.setQueryData(commentKeys.list("p1", { type: "free" }), initialList);

        // --- Mock apiGetPaged：重拉时返回 replies_total=3 ---
        vi.mocked(apiGetPaged).mockResolvedValue({
            data: [makeComment({ id: "c1", replies_total: 3, replies: [] })],
            pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        });

        // --- Mock apiPost 返回新回复 ---
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

        // --- 同时渲染 useComments（激活 query）和 useCreateComment ---
        const { result } = renderHook(
            () => ({
                comments: useComments("p1", { type: "free" }),
                create: useCreateComment("p1"),
            }),
            { wrapper: createWrapper(qc) },
        );

        // 初始 replies_total=2
        expect(result.current.comments.data?.data[0].replies_total).toBe(2);

        // 触发回复提交
        await result.current.create.mutateAsync({ body: "My new reply", parent_id: "c1" });

        // 失效后重拉完成，replies_total 应刷新为 3
        await waitFor(() => {
            expect(result.current.comments.data?.data[0].replies_total).toBe(3);
        });
    });

    it("已展开回复区时提交回复，useReplies 缓存应含新回复", async () => {
        // --- 种入顶层评论列表缓存 ---
        const topComment = makeComment({ id: "c1", replies_total: 1, replies: [] });
        const listData: PagedResponse<Comment> = {
            data: [topComment],
            pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        };
        qc.setQueryData(commentKeys.list("p1", { type: "free" }), listData);

        // --- 种入 useReplies 缓存（模拟回复区已展开） ---
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

        // --- Mock apiGetPaged（列表重拉时不影响已展开的 useReplies 缓存） ---
        vi.mocked(apiGetPaged).mockResolvedValue({
            data: [makeComment({ id: "c1", replies_total: 2, replies: [] })],
            pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        });

        // --- Mock apiPost ---
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

        // --- 渲染并触发 ---
        const { result } = renderHook(() => useCreateComment("p1"), {
            wrapper: createWrapper(qc),
        });

        await result.current.mutateAsync({ body: "Second reply", parent_id: "c1" });

        // --- 断言：useReplies 缓存第一页应包含新回复 ---
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
