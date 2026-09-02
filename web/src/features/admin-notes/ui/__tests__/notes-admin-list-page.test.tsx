import type { AdminNoteSummary } from "@features/admin-notes/model/types";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotesAdminListPage } from "../NotesAdminListPage";

vi.mock("@features/admin-shared/ui/data-table", () => ({
	usePagedQuery: vi.fn(),
	DataTable: (props: { data: unknown[]; columns: unknown[] }) => (
		<div>
			<div data-testid="row-count">{props.data.length}</div>
			{/* 平铺渲染第一列 cell 以断言列定义行为 */}
			{props.data.map((row, i) => {
				const col = props.columns[0] as {
					cell: (row: unknown) => { props: { children: unknown } };
				};
				const rendered = col.cell(row as AdminNoteSummary);
				if (!rendered) return null;
				const button = rendered as {
					props: { onClick?: () => void; children?: ReactNode };
				};
				return (
					<button key={i} type="button" onClick={button.props.onClick}>
						{button.props.children ?? null}
					</button>
				);
			})}
		</div>
	),
}));

vi.mock("@features/admin-notes/api/queries", () => ({
	useAdminNotes: vi.fn(),
}));

vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({
		title,
		children,
		sticky,
	}: {
		title: string;
		children: ReactNode;
		sticky?: ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
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
		id: "n1",
		author_id: "u1",
		title: "",
		status: "draft",
		tags: [],
		created_at: "2026-09-03T00:00:00Z",
		updated_at: "2026-09-03T00:00:00Z",
		published_at: null,
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
});
