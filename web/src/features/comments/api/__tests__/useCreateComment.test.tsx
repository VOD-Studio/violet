/**
 * useCreateComment mutation 缓存行为测试
 *
 * 验证提交回复后缓存是否正确更新——不触发列表重拉（避免批注 relocate 重算）。
 */
import type { Comment } from "@entities/comment/model/types";
import type { PagedResponse } from "@shared/api/types";
import { CommentItem } from "@shared/ui/comment-section";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGetPaged: vi.fn(),
	apiGet: vi.fn(),
	apiDelete: vi.fn(),
	apiPatch: vi.fn(),
}));

import { apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import { buildArticleCommentConfig } from "../../ui/comment-config";
import { commentKeys } from "../keys";
import { useCreateComment } from "../mutations";
import { useComments } from "../queries";

function createWrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
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

function ArticleThread() {
	const { data } = useComments("p1", { type: "free" });
	const config = buildArticleCommentConfig({ postId: "p1", isLoggedIn: true });
	// 反应条与回复身份无关，其余表单、查询、映射和回复展示均走真实实现。
	config.renderActions = () => null;
	return data?.data.map((comment) => (
		<CommentItem
			key={comment.id}
			item={config.map(comment)}
			level={0}
			isLoggedIn
			config={config}
		/>
	));
}

describe("useCreateComment — 回复缓存更新", () => {
	let qc: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGet).mockResolvedValue([]);
		qc = new QueryClient({
			defaultOptions: {
				queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
				mutations: { retry: false },
			},
		});
	});

	afterEach(() => {
		cleanup();
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
				thread_root_id: "c1",
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
				thread_root_id: "c1",
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

	it.each([
		{ name: "目标与楼主同名", targetName: "Alice", outsidePreview: false },
		{ name: "目标不在可见预览中", targetName: "Bob", outsidePreview: true },
	])("$name：二级回复立即显示目标并更新所属顶层线程", async ({ targetName, outsidePreview }) => {
		const target = makeComment({
			id: "r-target",
			parent_id: "c1",
			thread_root_id: "c1",
			depth: 1,
			author_name: targetName,
			body: "被回复的二级评论",
		});
		const preview = makeComment({
			id: "r-preview",
			parent_id: "c1",
			thread_root_id: "c1",
			depth: 1,
			author_name: "预览作者",
			body: "首屏预览",
		});
		qc.setQueryData(commentKeys.list("p1", { type: "free" }), {
			data: [
				makeComment({
					replies_total: outsidePreview ? 4 : 1,
					replies: [outsidePreview ? preview : target],
				}),
			],
			pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
		});
		const replyKey = commentKeys.replyList("c1", { limit: 10 });
		qc.setQueryData(replyKey, {
			pages: [
				{
					data: [preview, target],
					pagination: { page: 1, limit: 10, total: 4, total_pages: 1 },
				},
			],
			pageParams: [1],
		});
		vi.mocked(apiPost).mockResolvedValue(
			makeComment({
				id: "r-new",
				parent_id: "r-target",
				thread_root_id: "c1",
				depth: 1,
				reply_to_name: targetName,
				author_name: "回复者",
				body: "刚提交的二级回复",
				status: "pending",
			}),
		);
		render(<ArticleThread />, { wrapper: createWrapper(qc) });
		if (outsidePreview) {
			expect(screen.queryByText("被回复的二级评论")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: "查看全部 4 条回复" }));
			await screen.findByText("被回复的二级评论");
		}
		const replyButtons = screen.getAllByRole("button", { name: "回复" });
		fireEvent.click(replyButtons[outsidePreview ? 2 : 1]);
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "刚提交的二级回复";
		fireEvent.input(editor);
		fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

		await screen.findByText("刚提交的二级回复");
		expect(screen.getByText(`@${targetName}`)).toBeTruthy();
		expect(screen.getByText("审批中")).toBeTruthy();
		expect(apiPost).toHaveBeenCalledWith("/posts/p1/comments", {
			body: "刚提交的二级回复",
			parent_id: "r-target",
		});
		await waitFor(() => {
			const list = qc.getQueryData<PagedResponse<Comment>>(
				commentKeys.list("p1", { type: "free" }),
			);
			expect(list?.data[0].replies_total).toBe(outsidePreview ? 5 : 2);
			const replies = qc.getQueryData<{ pages: PagedResponse<Comment>[] }>(replyKey);
			expect(
				replies?.pages.flatMap((page) => page.data).filter((reply) => reply.id === "r-new"),
			).toHaveLength(1);
		});
		expect(apiGetPaged).not.toHaveBeenCalled();
		expect(qc.getQueryData(commentKeys.replyList("r-target", { limit: 10 }))).toBeUndefined();
	});

	it("未展开时直接回复一级，立即显示且不添加冗余目标标注或创建分页缓存", async () => {
		qc.setQueryData(commentKeys.list("p1", { type: "free" }), {
			data: [makeComment({ replies_total: 0, replies: [] })],
			pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
		});
		vi.mocked(apiPost).mockResolvedValue(
			makeComment({
				id: "r-new",
				parent_id: "c1",
				thread_root_id: "c1",
				depth: 1,
				reply_to_name: "Alice",
				author_name: "回复者",
				body: "直接回复楼主",
				status: "pending",
			}),
		);
		render(<ArticleThread />, { wrapper: createWrapper(qc) });
		fireEvent.click(screen.getByRole("button", { name: "回复" }));
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "直接回复楼主";
		fireEvent.input(editor);
		fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

		await screen.findByText("直接回复楼主");
		expect(screen.queryByText("@Alice")).toBeNull();
		expect(apiPost).toHaveBeenCalledWith("/posts/p1/comments", {
			body: "直接回复楼主",
			parent_id: "c1",
		});
		expect(qc.getQueryData(commentKeys.replyList("c1", { limit: 10 }))).toBeUndefined();
		expect(apiGetPaged).not.toHaveBeenCalled();
	});
});
