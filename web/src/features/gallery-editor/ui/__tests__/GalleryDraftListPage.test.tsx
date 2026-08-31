import type { GallerySummary } from "@entities/gallery/model/types";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const rows: GallerySummary[] = [
	{
		id: "draft-1",
		author_id: "author-1",
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
		author_id: "author-1",
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
	usePagedQuery: () => ({
		data: { data: rows },
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		pagination: {},
	}),
}));

vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("@features/gallery-editor/api/mutations", () => ({
	useCreateGalleryDraft: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@features/gallery-editor/api/queries", () => ({
	useAdminGalleries: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

import { GalleryDraftListPage } from "../GalleryDraftListPage";

describe("GalleryDraftListPage", () => {
	it("按服务端状态显示四种维护状态", () => {
		render(<GalleryDraftListPage />);

		expect(screen.getByText("工作稿")).toBeTruthy();
		expect(screen.getByText("已发布")).toBeTruthy();
		expect(screen.getByText("有未发布修改")).toBeTruthy();
		expect(screen.getByText("已撤回")).toBeTruthy();
	});
});
