import type { PublicNote } from "@entities/note/model/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotesPage } from "../NotesPage";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		search,
		params,
		children,
		...rest
	}: {
		to: string;
		search?: { tag?: string };
		params?: Record<string, string>;
		children?: React.ReactNode;
	} & Record<string, unknown>) => (
		<a
			href={
				typeof to === "string" && to.includes("$")
					? to.replace(/\$(\w+)/, (_m, k: string) => params?.[k] ?? "")
					: to
			}
			data-search={search ? JSON.stringify(search) : undefined}
			{...rest}
		>
			{children}
		</a>
	),
}));

vi.mock("@entities/note/api/queries", () => ({
	usePublishedNotesFeed: vi.fn(),
}));

import { usePublishedNotesFeed } from "@entities/note/api/queries";

const mockFeed = vi.mocked(usePublishedNotesFeed);

function note(overrides: Partial<PublicNote>): PublicNote {
	return {
		id: "n1",
		title: "",
		content_html: "<p>正文</p>",
		tags: [],
		published_at: "2026-09-02T10:00:00Z",
		...overrides,
	};
}

function setFeed(overrides: Record<string, unknown>) {
	mockFeed.mockReturnValue({
		notes: [],
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
		hasMore: false,
		loadingMore: false,
		loadMoreFailed: false,
		loadMore: vi.fn(),
		...overrides,
	} as never);
}

describe("NotesPage", () => {
	it("加载中渲染骨架不渲染条目", () => {
		setFeed({ isLoading: true });
		render(<NotesPage />);
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("空态渲染占位", () => {
		setFeed({});
		render(<NotesPage />);
		expect(screen.getByText("暂无笔记")).toBeTruthy();
	});

	it("条目按序号渲染并链接到详情，无标题笔记以正文兜底", () => {
		setFeed({
			notes: [
				note({ id: "a", title: "Redis 取整坑", tags: ["redis"] }),
				note({ id: "b", content_html: "<p>du 与 ls 的取整差异</p>" }),
			],
		});
		render(<NotesPage />);
		expect(screen.getByText("Redis 取整坑")).toBeTruthy();
		expect(screen.getByText("du 与 ls 的取整差异")).toBeTruthy();
		expect(screen.getByText("01")).toBeTruthy();
		expect(screen.getByText("02")).toBeTruthy();
		const link = screen.getByText("Redis 取整坑").closest("a");
		expect(link?.getAttribute("href")).toBe("/notes/a");
	});

	it("标签筛选态渲染当前标签", () => {
		setFeed({ notes: [note({ tags: ["redis"] })] });
		render(<NotesPage tag="redis" />);
		expect(screen.getByText("按标签筛选：")).toBeTruthy();
		// 页头高亮标签 + 行内标签都会出现 redis
		expect(screen.getAllByText("redis").length).toBeGreaterThan(0);
	});
});
