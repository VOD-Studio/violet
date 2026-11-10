/**
 * CommentSection（文章底部评论区）生产行为测试
 *
 * 以真实挂载方式渲染 feature 容器（useInfiniteQuery 顶层列表 + shared 展示层 +
 * 提交表单），只 mock 传输层；验证回复提交后的用户可见结果，不测内部缓存形态。
 */
import type { Comment } from "@entities/comment/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));
vi.mock("@shared/api/request", () => requests);

import { CommentSection } from "../CommentSection";

const PAGE = { page: 1, limit: 20, total_pages: 1 };

function reply(id: string, body: string, over: Partial<Comment> = {}): Comment {
	return {
		id,
		post_id: "p1",
		depth: 1,
		parent_id: "c1",
		thread_root_id: "c1",
		author_name: `作者${id}`,
		avatar_url: "",
		body,
		pictures: [],
		is_author: false,
		status: "approved",
		created_at: "2026-01-01T00:00:00Z",
		...over,
	};
}

function renderSection() {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Infinity },
			mutations: { retry: false },
		},
	});
	return render(
		<QueryClientProvider client={qc}>
			<CommentSection postId="p1" />
		</QueryClientProvider>,
	);
}

async function submitReply(text: string) {
	fireEvent.click(screen.getAllByRole("button", { name: "回复" })[0]);
	// 顶部另有常驻的顶级评论表单，点「回复」后取新展开的内联表单（DOM 顺序在后）。
	const editor = screen.getAllByRole("textbox", { name: "评论内容" }).at(-1);
	if (!editor) throw new Error("内联回复表单未展开");
	editor.textContent = text;
	fireEvent.input(editor);
	fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
	// 提交成功后内联表单收起，只剩顶部常驻表单；此后该文本只能来自已展示的评论条目。
	await waitFor(() =>
		expect(screen.getAllByRole("textbox", { name: "评论内容" })).toHaveLength(1),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	requests.apiGet.mockImplementation(async (path: string) =>
		path === "/auth/me" ? { id: "u1", username: "登录者" } : [],
	);
	requests.apiGetPaged.mockResolvedValue({
		data: [
			{
				id: "c1",
				post_id: "p1",
				depth: 0,
				author_name: "楼主",
				avatar_url: "",
				body: "顶层评论",
				pictures: [],
				is_author: false,
				status: "approved",
				created_at: "2026-01-01T00:00:00Z",
				replies_total: 5,
				replies: [reply("r1", "第一条"), reply("r2", "第二条"), reply("r3", "第三条")],
			} satisfies Comment,
		],
		pagination: { ...PAGE, total: 1 },
	});
	requests.apiPost.mockImplementation(async (path: string) =>
		path === "/comments/reactions/batch" ? [] : null,
	);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("CommentSection 回复的即时展示", () => {
	it("回复数超过预览阈值时提交新回复，立即可见且「查看全部」计数同步递增", async () => {
		requests.apiPost.mockImplementation(async (path: string) => {
			if (path === "/comments/reactions/batch") return [];
			return reply("r6", "刚发出的第六条", { status: "pending" });
		});
		renderSection();

		await screen.findByText("顶层评论");
		expect(screen.getByText("查看全部 5 条回复")).toBeTruthy();

		await submitReply("刚发出的第六条");

		expect(screen.getByText("刚发出的第六条")).toBeTruthy();
		expect(screen.getByText("查看全部 6 条回复")).toBeTruthy();
	});
});
