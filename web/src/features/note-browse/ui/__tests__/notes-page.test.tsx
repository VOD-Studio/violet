import { useJournalFeed } from "@entities/note/api/queries";
import type {
	JournalEntry,
	ProgressDay,
	ProgressHealth,
	PublicNote,
} from "@entities/note/model/types";
import { apiGet } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

vi.mock(import("@entities/note/api/queries"), async (importOriginal) => ({
	...(await importOriginal()),
	useJournalFeed: vi.fn(),
}));

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn() }));

vi.mock("@entities/project/api/queries", () => ({
	useProjects: () => ({ data: [], isLoading: false }),
}));

vi.mock("@features/tags/api/queries", () => ({
	useTags: () => ({ data: [{ id: 1, name: "Redis 缓存", slug: "redis" }] }),
}));

const mockFeed = vi.mocked(useJournalFeed);

function noteEntry(overrides: Partial<PublicNote>): JournalEntry {
	return { kind: "note", note: note(overrides) };
}

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

function setFeed(overrides: {
	entries?: JournalEntry[];
	isLoading?: boolean;
	progress?: ProgressHealth;
}) {
	mockFeed.mockReturnValue({
		entries: [],
		progress: null,
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
			entries: [
				noteEntry({ id: "a", title: "Redis 取整坑", published_at: "2026-09-02T02:00:00Z" }),
				noteEntry({
					content_html: "<p>du &amp; ls 的<strong>取整差异</strong></p>",
					published_at: "2026-09-01T17:00:00Z",
				}),
				noteEntry({ id: "c", title: "前一天", published_at: "2026-09-01T15:00:00Z" }),
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
		setFeed({ entries: [noteEntry({ tags: ["Redis 缓存", "无匹配标签"] })] });
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
		fireEvent.click(screen.getByRole("radio", { name: "进展" }));
		expect(onSearchChange).toHaveBeenLastCalledWith({
			type: "progress",
			project_id: projectId,
		});
	});

	const unavailableProgress: { state: ProgressHealth["state"]; message: string }[] = [
		{ state: "unconfigured", message: "尚未配置自动进展来源。" },
		{ state: "syncing", message: "正在同步仓库进展。" },
		{ state: "ready", message: "暂无仓库进展。" },
		{ state: "limited", message: "自动进展同步受限流影响，暂未更新。" },
		{ state: "failed", message: "自动进展同步失败，暂未更新。" },
	];

	it.each(unavailableProgress)("进展状态 $state 不替代已发布的手写手记", ({ state, message }) => {
		setFeed({
			entries: [noteEntry({ title: "仍可阅读" })],
			progress: { state, reason: null, last_synced_at: null },
		});
		const onSearchChange = vi.fn();
		const { rerender } = render(<NotesPage search={{}} onSearchChange={onSearchChange} />);
		expect(screen.getByText(message)).toBeTruthy();
		expect(screen.getByRole("link", { name: "仍可阅读" })).toBeTruthy();

		rerender(<NotesPage search={{ type: "pitfall" }} onSearchChange={onSearchChange} />);
		expect(screen.queryByText(message)).toBeNull();
		expect(screen.getByRole("link", { name: "仍可阅读" })).toBeTruthy();
	});

	it("同日合并两种来源，进展手记按卡惰性加载并可重试", async () => {
		const projectId = "0e9bc14a-3588-4dc1-9862-02562b6d6ee0";
		const day = "2026-09-02";
		const commits = Array.from({ length: 7 }, (_, index) => ({
			sha: `${index}000000`,
			title: `提交标题 ${index}`,
			url: `https://github.com/violet/project/commit/${index}`,
			occurred_at: "2026-09-02T02:34:00Z",
		}));
		const progress: ProgressDay = {
			day,
			project: { id: projectId, slug: "violet", title: "Violet" },
			first_at: "2026-09-01T17:24:00Z",
			last_at: "2026-09-02T02:34:00Z",
			commit_count: 7,
			release_count: 1,
			summary: "修复真实日卡",
			commits: commits.slice(0, 6),
			releases: [
				{
					tag: "v2.0.0",
					title: "稳定版",
					url: "https://github.com/violet/project/releases/tag/v2.0.0",
					occurred_at: "2026-09-02T02:34:00Z",
				},
			],
		};
		vi.mocked(apiGet)
			.mockRejectedValueOnce(new Error("unavailable"))
			.mockResolvedValueOnce({ ...progress, commits });
		setFeed({
			entries: [{ kind: "progress", progress }, noteEntry({ title: "手写手记" })],
			progress: { state: "stale", reason: "limited", last_synced_at: null },
		});
		const client = new QueryClient();
		render(
			<QueryClientProvider client={client}>
				<NotesPage search={{}} onSearchChange={vi.fn()} />
			</QueryClientProvider>,
		);

		expect(screen.getAllByRole("heading", { name: "2026年9月2日" })).toHaveLength(1);
		expect(screen.getByRole("link", { name: "手写手记" })).toBeTruthy();
		expect(screen.getByText(/限流/)).toBeTruthy();
		expect(screen.getByText("01:24")).toBeTruthy();
		expect(screen.getByText("10:34")).toBeTruthy();
		expect(screen.getByRole("link", { name: "v2.0.0" }).getAttribute("href")).toBe(
			"https://github.com/violet/project/releases/tag/v2.0.0",
		);
		expect(screen.getByRole("link", { name: "提交标题 5" })).toBeTruthy();
		expect(screen.queryByRole("link", { name: "提交标题 6" })).toBeNull();
		expect(apiGet).not.toHaveBeenCalled();

		const trigger = screen.getByRole("button", { name: "另 1 个提交" });
		trigger.focus();
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(document.activeElement).toBe(trigger);
		expect(await screen.findByText("提交加载失败。")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "重试加载提交" }));
		expect((await screen.findByRole("link", { name: "提交标题 6" })).getAttribute("href")).toBe(
			"https://github.com/violet/project/commit/6",
		);
		expect(screen.getAllByRole("link", { name: "提交标题 5" })).toHaveLength(1);
		expect(apiGet).toHaveBeenLastCalledWith(
			`/journal/progress/${projectId}/${day}`,
			expect.objectContaining({ signal: expect.anything() }),
		);
	});
});
