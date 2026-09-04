import type { AdminNoteSummary } from "@features/admin-notes/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotesAdminListPage } from "../NotesAdminListPage";

vi.mock("@features/admin-shared/ui/data-table", () => ({
	usePagedQuery: vi.fn(),
	DataTable: (props: { data: unknown[]; columns: unknown[] }) => (
		<div>
			<div data-testid="row-count">{props.data.length}</div>
			{props.data.map((row, i) => {
				const col = props.columns[0] as {
					cell: (row: unknown) => ReactNode;
				};
				return <div key={i}>{col.cell(row as AdminNoteSummary)}</div>;
			})}
		</div>
	),
}));

vi.mock("@features/admin-notes/api/queries", () => ({
	useAdminNotes: vi.fn(),
	useAdminNote: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock("@features/admin-notes/api/mutations", () => ({
	useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useSaveNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
	usePublishNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@features/tags/api/queries", () => ({
	useTags: () => ({ data: [] }),
}));

vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({
		title,
		children,
		action,
		sticky,
	}: {
		title: string;
		children: ReactNode;
		action?: ReactNode;
		sticky?: ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			{action}
			{sticky}
			{children}
		</div>
	),
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

import { usePagedQuery } from "@features/admin-shared/ui/data-table";

const mockPaged = vi.mocked(usePagedQuery);

function summary(overrides: Partial<AdminNoteSummary>): AdminNoteSummary {
	return {
		id: "n-1",
		author_id: "u-1",
		title: "测试笔记",
		status: "published",
		tags: [],
		created_at: "2026-09-02T00:00:00Z",
		updated_at: "2026-09-02T00:00:00Z",
		published_at: "2026-09-02T00:00:00Z",
		...overrides,
	};
}

function setPaged(rows: AdminNoteSummary[]) {
	mockPaged.mockReturnValue({
		data: { data: rows },
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		pagination: {} as never,
		setPage: vi.fn(),
	} as never);
}

describe("NotesAdminListPage", () => {
	it("渲染页头与状态筛选", () => {
		setPaged([]);
		render(<NotesAdminListPage />);
		expect(screen.getByText("笔记管理")).toBeTruthy();
		expect(screen.getByRole("combobox")).toBeTruthy();
	});

	it("无标题笔记行以 ID 前缀兜底显示", () => {
		setPaged([
			summary({ id: "abc12345-xxxx", title: "" }),
			summary({ id: "n2", title: "有标题" }),
		]);
		render(<NotesAdminListPage />);
		expect(screen.getByText("（无标题）abc12345")).toBeTruthy();
		expect(screen.getByText("有标题")).toBeTruthy();
	});

	it("点击新建笔记能够唤起抽屉", () => {
		setPaged([]);
		render(<NotesAdminListPage />);
		const createButton = screen.getByRole("button", { name: "新建笔记" });
		fireEvent.click(createButton);
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByText("新建笔记", { selector: "h2" })).toBeTruthy();
	});
});
