import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { latestNote, latestPost, useProfileLatest } from "../profile-latest";

const fetchPosts = vi.fn();
const fetchPublishedNotes = vi.fn();

vi.mock("@features/posts/api/queries", () => ({
	fetchPosts: (...args: unknown[]) => fetchPosts(...args),
}));
vi.mock("@entities/note/api/queries", () => ({
	fetchPublishedNotes: (...args: unknown[]) => fetchPublishedNotes(...args),
}));

const page = <T,>(data: T[]) => ({ data, pagination: { next_cursor: null } });
const post = (title: string, slug: string, published_at: string) => ({
	title,
	slug,
	published_at,
});

function wrapper() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}

describe("latestPost / latestNote", () => {
	it("文章：标题、月.日、链到文章详情", () => {
		const latest = latestPost([post("测试发送", "ce-shi", "2026-10-10T08:00:00+08:00")]);
		expect(latest).toMatchObject({ title: "测试发送", href: "/blog/ce-shi" });
		expect(latest?.date).toMatch(/^\d{2}\.\d{2}$/);
	});

	it("公开列表精选优先：取发布时间最新的一篇，不是排第一的那篇", () => {
		const latest = latestPost([
			post("精选旧文", "old", "2025-01-01T00:00:00Z"),
			post("最新文章", "new", "2026-10-10T00:00:00Z"),
			post("中间", "mid", "2026-05-01T00:00:00Z"),
		]);
		expect(latest?.title).toBe("最新文章");
		expect(latestPost([])).toBeUndefined();
		expect(latestPost(undefined)).toBeUndefined();
	});

	it("手记：没有标题时以正文开头兜底，链到手记详情", () => {
		const note = latestNote({
			id: "n1",
			title: "",
			content_html: "<p>实时状态接入，发布 2.22.1</p>",
			published_at: "2026-10-29T08:00:00+08:00",
		});
		expect(note?.title).toContain("实时状态接入");
		expect(note?.href).toBe("/notes/n1");
		expect(latestNote(undefined)).toBeUndefined();
	});
});

describe("useProfileLatest", () => {
	beforeEach(() => {
		fetchPosts.mockReset();
		fetchPublishedNotes.mockReset();
	});

	it("未启用时不发请求，也不是加载中", () => {
		const { result } = renderHook(() => useProfileLatest(false), { wrapper: wrapper() });
		expect(fetchPosts).not.toHaveBeenCalled();
		expect(fetchPublishedNotes).not.toHaveBeenCalled();
		expect(result.current).toEqual({ latest: {}, pending: { post: false, note: false } });
	});

	it("启用后加载中按条标记，到达后各自解除并给出两条", async () => {
		fetchPosts.mockResolvedValue(
			page([
				post("精选旧文", "old", "2025-01-01T00:00:00Z"),
				post("测试发送", "ce-shi", "2026-10-10T08:00:00+08:00"),
			]),
		);
		fetchPublishedNotes.mockResolvedValue(
			page([
				{
					id: "n1",
					title: "实时状态接入",
					content_html: "",
					published_at: "2026-10-29T08:00:00+08:00",
				},
			]),
		);
		const { result } = renderHook(() => useProfileLatest(true), { wrapper: wrapper() });
		expect(result.current.pending).toEqual({ post: true, note: true });
		await waitFor(() => expect(result.current.pending).toEqual({ post: false, note: false }));
		expect(result.current.latest.post?.title).toBe("测试发送");
		expect(result.current.latest.note?.title).toBe("实时状态接入");
	});

	it("某一边失败时它不再加载，另一边照常显示", async () => {
		fetchPosts.mockRejectedValue(new Error("500"));
		fetchPublishedNotes.mockResolvedValue(
			page([
				{
					id: "n1",
					title: "只有手记",
					content_html: "",
					published_at: "2026-10-29T00:00:00Z",
				},
			]),
		);
		const { result } = renderHook(() => useProfileLatest(true), { wrapper: wrapper() });
		await waitFor(() => expect(result.current.pending).toEqual({ post: false, note: false }));
		expect(result.current.latest.post).toBeUndefined();
		expect(result.current.latest.note?.title).toBe("只有手记");
	});
});
