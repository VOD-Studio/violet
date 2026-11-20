import { usePublishedNotesFeed } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotesPage } from "../NotesPage";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		search,
		params,
		children,
		...props
	}: {
		to: string;
		search?: Record<string, string | undefined>;
		params?: Record<string, string>;
	} & React.ComponentProps<"a">) => {
		const url = new URL(
			to.replace(/\$(\w+)/, (_match, key: string) => params?.[key] ?? ""),
			"https://violet.example",
		);
		for (const [key, value] of Object.entries(search ?? {})) {
			if (value !== undefined) url.searchParams.set(key, value);
		}
		return (
			<a {...props} href={`${url.pathname}${url.search}`}>
				{children}
			</a>
		);
	},
}));

vi.mock("@entities/note/api/queries", () => ({ usePublishedNotesFeed: vi.fn() }));

vi.mock("@entities/project/api/queries", () => ({
	useProjects: () => ({ data: [], isLoading: false }),
}));

vi.mock("@features/tags/api/queries", () => ({
	useTags: () => ({ data: [{ id: 1, name: "Redis 缓存", slug: "redis" }] }),
}));

const mockFeed = vi.mocked(usePublishedNotesFeed);

function note(overrides: Partial<PublicNote>): PublicNote {
	return {
		id: "n1",
		title: "",
		content_html: "<p>正文</p>",
		tags: [],
		published_at: "2026-09-02T10:00:00Z",
		type: "unclassified",
		project: null,
		pitfall: null,
		...overrides,
	};
}

function setFeed(overrides: { notes?: PublicNote[]; isLoading?: boolean }) {
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
	});
}

describe("NotesPage", () => {
	it("加载时保留筛选控件，不渲染条目", () => {
		setFeed({ isLoading: true });
		render(<NotesPage search={{}} onSearchChange={vi.fn()} />);
		expect(screen.getByRole("heading", { name: "手记" })).toBeTruthy();
		expect(screen.getByRole("radio", { name: "全部" }).getAttribute("aria-checked")).toBe(
			"true",
		);
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("空态渲染占位", () => {
		setFeed({});
		render(<NotesPage search={{}} onSearchChange={vi.fn()} />);
		expect(screen.getByText("暂无手记")).toBeTruthy();
	});

	it("条目按上海日历日归档，标题链接到手记详情，无标题手记以正文兜底", () => {
		setFeed({
			notes: [
				note({ id: "a", title: "Redis 取整坑", published_at: "2026-09-02T02:00:00Z" }),
				note({
					content_html: "<p>du &amp; ls 的<strong>取整差异</strong></p>",
					published_at: "2026-09-01T17:00:00Z",
				}),
				note({ id: "c", title: "前一天", published_at: "2026-09-01T15:00:00Z" }),
			],
		});
		render(<NotesPage search={{}} onSearchChange={vi.fn()} />);
		expect(screen.getAllByRole("heading", { name: "2026年9月2日" })).toHaveLength(1);
		expect(screen.getAllByRole("heading", { name: "2026年9月1日" })).toHaveLength(1);
		const link = screen.getByRole("link", { name: "Redis 取整坑" });
		expect(link.getAttribute("href")).toBe("/journal/a");
		expect(screen.getByRole("link", { name: "du & ls 的取整差异" })).toBeTruthy();
	});

	it("已知标签使用真实 slug，清除标签与切换类型保留其他筛选", () => {
		const onSearchChange = vi.fn();
		const projectId = "0e9bc14a-3588-4dc1-9862-02562b6d6ee0";
		setFeed({ notes: [note({ tags: ["Redis 缓存", "无匹配标签"] })] });
		render(
			<NotesPage
				search={{ tag: "redis", project_id: projectId }}
				onSearchChange={onSearchChange}
			/>,
		);
		expect(screen.getByRole("link", { name: "#Redis 缓存" }).getAttribute("href")).toBe(
			`/journal?tag=redis&project_id=${projectId}`,
		);
		expect(screen.queryByRole("link", { name: "#无匹配标签" })).toBeNull();
		expect(screen.getByRole("link", { name: "清除标签筛选" }).getAttribute("href")).toBe(
			`/journal?project_id=${projectId}`,
		);
		fireEvent.click(screen.getByRole("radio", { name: "踩坑" }));
		expect(onSearchChange).toHaveBeenCalledWith({
			tag: "redis",
			type: "pitfall",
			project_id: projectId,
		});
	});
});
