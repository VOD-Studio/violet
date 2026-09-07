import type { PersonaSummary } from "@entities/persona/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listQuery, navigate, setPage } = vi.hoisted(() => ({
	listQuery: vi.fn(),
	navigate: vi.fn(),
	setPage: vi.fn(),
}));

const rows: PersonaSummary[] = [
	{
		id: "persona-current",
		name: "若菫瑠爱｜RUA",
		subtitle: "信息设计专业",
		summary: "当前公开人设",
		locales: ["zh-CN", "ja-JP"],
		fact_count: 10,
		image_count: 5,
		is_active: true,
		is_complete: true,
		version: 4,
		created_at: "2026-09-07T00:00:00Z",
		updated_at: "2026-09-07T01:00:00Z",
	},
	{
		id: "persona-draft",
		name: "候选档案",
		subtitle: "",
		summary: "",
		locales: ["zh-CN"],
		fact_count: 0,
		image_count: 0,
		is_active: false,
		is_complete: false,
		version: 1,
		created_at: "2026-09-07T00:00:00Z",
		updated_at: "2026-09-07T00:00:00Z",
	},
];

vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({
		children,
		action,
		sticky,
	}: {
		children: ReactNode;
		action?: ReactNode;
		sticky?: ReactNode;
	}) => (
		<div>
			{action}
			{sticky}
			{children}
		</div>
	),
}));

vi.mock("@features/admin-shared/ui/data-table", () => ({
	DataTable: ({
		columns,
		data,
	}: {
		columns: Array<{ key: string; cell?: (row: PersonaSummary) => ReactNode }>;
		data: PersonaSummary[];
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
		useList({ ...baseQuery, page: 1, limit: 20 });
		return {
			data: { data: rows },
			isLoading: false,
			error: null,
			refetch: vi.fn(),
			pagination: {},
			setPage,
		};
	},
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("@features/persona-editor/api/mutations", () => ({
	useCreatePersona: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useDeletePersona: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@features/persona-editor/api/queries", () => ({
	useAdminPersonas: (query: Record<string, unknown>) => listQuery(query),
}));

vi.mock("@shared/ui/search-input", () => ({
	SearchInput: ({ onSearch }: { onSearch: (value: string) => void }) => (
		<input aria-label="搜索人设" onChange={(event) => onSearch(event.target.value)} />
	),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

import { PersonaListPage } from "../PersonaListPage";

describe("PersonaListPage", () => {
	beforeEach(() => {
		listQuery.mockReset();
		setPage.mockReset();
	});

	it("同时区分当前人设、未激活草稿与资料完整度", () => {
		render(<PersonaListPage />);

		expect(screen.getByText("当前人设")).toBeTruthy();
		expect(screen.getByText("未激活")).toBeTruthy();
		expect(screen.getByText("完整")).toBeTruthy();
		expect(screen.getByText("待补全")).toBeTruthy();

		const currentDelete = screen.getByRole("button", { name: "删除人设 若菫瑠爱｜RUA" });
		const draftDelete = screen.getByRole("button", { name: "删除人设 候选档案" });
		expect((currentDelete as HTMLButtonElement).disabled).toBe(true);
		expect((draftDelete as HTMLButtonElement).disabled).toBe(false);
	});

	it("角色名称搜索回到第一页并进入服务端查询", () => {
		render(<PersonaListPage />);
		fireEvent.change(screen.getByRole("textbox", { name: "搜索人设" }), {
			target: { value: "  RUA  " },
		});

		expect(setPage).toHaveBeenCalledWith(1);
		expect(listQuery).toHaveBeenLastCalledWith(
			expect.objectContaining({ q: "RUA", page: 1, limit: 20 }),
		);
	});
});
