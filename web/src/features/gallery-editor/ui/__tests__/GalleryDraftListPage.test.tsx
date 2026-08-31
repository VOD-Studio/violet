import type { GallerySummary } from "@entities/gallery/model/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: GallerySummary[] = [
	{
		id: "draft-1",
		author_id: "author-1",
		author_name: "我本人",
		title: "未发布图集",
		summary: "",
		status: "draft",
		slug: null,
		published_at: null,
		version: 1,
		item_count: 2,
		created_at: "2026-08-31T00:00:00Z",
		updated_at: "2026-08-31T00:00:00Z",
	},
	{
		id: "published-1",
		author_id: "author-1",
		author_name: "我本人",
		title: "公开图集",
		summary: "",
		status: "published",
		slug: "public-gallery",
		published_at: "2026-08-31T01:00:00Z",
		version: 2,
		item_count: 3,
		created_at: "2026-08-31T00:00:00Z",
		updated_at: "2026-08-31T01:00:00Z",
	},
	{
		id: "modified-1",
		author_id: "author-2",
		author_name: "另一位作者",
		title: "修改中的图集",
		summary: "",
		status: "modified",
		slug: "modified-gallery",
		published_at: "2026-08-31T01:00:00Z",
		version: 3,
		item_count: 3,
		created_at: "2026-08-31T00:00:00Z",
		updated_at: "2026-08-31T02:00:00Z",
	},
	{
		id: "unpublished-1",
		author_id: "author-1",
		author_name: "我本人",
		title: "已撤回图集",
		summary: "",
		status: "unpublished",
		slug: "unpublished-gallery",
		published_at: "2026-08-31T01:00:00Z",
		version: 4,
		item_count: 3,
		created_at: "2026-08-31T00:00:00Z",
		updated_at: "2026-08-31T03:00:00Z",
	},
];

vi.mock("@features/admin-shared/ui/data-table", () => ({
	DataTable: ({
		columns,
		data,
	}: {
		columns: Array<{ key: string; cell?: (row: GallerySummary) => ReactNode }>;
		data: GallerySummary[];
	}) => (
		<div>
			{data.map((row) => (
				<div key={row.id}>
					{columns.map((column) => (
						<div key={column.key}>{column.cell?.(row)}</div>
					))}
				</div>
			))}
		</div>
	),
	usePagedQuery: (
		useList: (query: Record<string, unknown>) => unknown,
		baseQuery: Record<string, unknown>,
	) => {
		// 复刻真实行为:把筛选合并进查询并交给列表 hook,供断言
		useList({ ...baseQuery, page: 1, limit: 20 });
		return {
			data: { data: rows },
			isLoading: false,
			error: null,
			refetch: vi.fn(),
			pagination: {},
			setPage: vi.fn(),
		};
	},
}));

vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({ children, sticky }: { children: ReactNode; sticky?: ReactNode }) => (
		<div>
			{sticky}
			{children}
		</div>
	),
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: { id: "author-1" } }),
}));

vi.mock("@features/gallery-editor/api/mutations", () => ({
	useCreateGalleryDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const useAdminGalleries = vi.fn((_query?: Record<string, unknown>) => ({
	data: { data: rows },
}));

vi.mock("@features/gallery-editor/api/queries", () => ({
	useAdminGalleries: (query: Record<string, unknown>) => useAdminGalleries(query ?? {}),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

import { GalleryDraftListPage } from "../GalleryDraftListPage";

describe("GalleryDraftListPage", () => {
	beforeEach(() => {
		useAdminGalleries.mockClear();
	});

	it("按服务端状态显示四种维护状态与作者名", () => {
		render(<GalleryDraftListPage />);

		expect(screen.getByText("工作稿")).toBeTruthy();
		expect(screen.getByText("已发布")).toBeTruthy();
		expect(screen.getByText("有未发布修改")).toBeTruthy();
		expect(screen.getByText("已撤回")).toBeTruthy();
		expect(screen.getByText("另一位作者")).toBeTruthy();
	});

	it("初始查询不带筛选参数", () => {
		render(<GalleryDraftListPage />);

		expect(useAdminGalleries).toHaveBeenCalledWith(
			expect.objectContaining({ author: undefined, status: undefined }),
		);
	});

	it("作者筛选回车后进入查询参数", async () => {
		render(<GalleryDraftListPage />);

		const input = screen.getByPlaceholderText("按作者用户名筛选...");
		fireEvent.change(input, { target: { value: "sun" } });
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(useAdminGalleries).toHaveBeenLastCalledWith(
				expect.objectContaining({ author: "sun" }),
			);
		});
	});
});
