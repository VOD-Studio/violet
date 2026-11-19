import type {
	AdminNote,
	AdminNoteSummary,
	NoteSaveRequest,
} from "@features/admin-notes/model/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "../NoteEditor";
import { NotesAdminListPage } from "../NotesAdminListPage";

const { mockAdminNote, mockCreate, mockSave, mockPublish } = vi.hoisted(() => ({
	mockAdminNote: vi.fn<() => { data?: AdminNote; isLoading: boolean }>(),
	mockCreate: vi.fn<(request: NoteSaveRequest) => Promise<AdminNote>>(),
	mockSave: vi.fn<(request: NoteSaveRequest) => Promise<AdminNote>>(),
	mockPublish: vi.fn<() => Promise<AdminNote>>(),
}));

vi.mock("@features/admin-shared/ui/data-table", () => ({
	usePagedQuery: vi.fn(),
}));

vi.mock("@violet/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@violet/ui")>()),
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
	useAdminNote: mockAdminNote,
}));

vi.mock("@features/admin-notes/api/mutations", () => ({
	useCreateNote: () => ({ mutateAsync: mockCreate, isPending: false }),
	useSaveNote: () => ({ mutateAsync: mockSave, isPending: false }),
	usePublishNote: () => ({ mutateAsync: mockPublish, isPending: false }),
	useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@features/tags/api/queries", () => ({
	useTags: () => ({ data: [] }),
}));

vi.mock("@entities/project/api/queries", () => ({
	useProjects: () => ({
		data: [{ id: "675a602f-f596-4f71-b8c5-80627c78d202", title: "Violet" }],
	}),
}));

vi.mock("@features/editor", () => ({
	RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
		<textarea
			aria-label="正文"
			value={value}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
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

function selectOption(label: string, option: string) {
	fireEvent.click(screen.getByRole("combobox", { name: label }));
	fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeEach(() => {
	mockAdminNote.mockReset().mockReturnValue({ isLoading: false });
	mockCreate.mockReset();
	mockSave.mockReset();
	mockPublish.mockReset();
});

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

	it("在抽屉创建踩坑笔记，并可重新打开查看已保存的字段", async () => {
		const journal = {
			type: "pitfall",
			project_id: "675a602f-f596-4f71-b8c5-80627c78d202",
			pitfall: {
				symptom: "请求超时",
				cause: "连接池耗尽",
				remedy: "释放连接",
				resolved: true,
				code: "defer conn.Close()",
			},
		} satisfies AdminNote["journal"];
		const saved: AdminNote = {
			...summary({ title: "连接池" }),
			content_md: "正文",
			content_html: "<p>正文</p>",
			journal,
		};
		setPaged([]);
		mockCreate.mockResolvedValue(saved);
		const page = render(<NotesAdminListPage />);
		fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
		expect(screen.getByRole("combobox", { name: "类型" }).textContent).toBe("未分类");
		fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), {
			target: { value: "连接池" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "正文" }), {
			target: { value: "正文" },
		});
		selectOption("类型", "踩坑");
		selectOption("关联项目", "Violet");
		fireEvent.change(screen.getByRole("textbox", { name: "现象" }), {
			target: { value: "请求超时" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "根因" }), {
			target: { value: "连接池耗尽" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "修法" }), {
			target: { value: "释放连接" },
		});
		fireEvent.click(screen.getByRole("checkbox", { name: "已解决" }));
		fireEvent.change(screen.getByRole("textbox", { name: "代码" }), {
			target: { value: "defer conn.Close()" },
		});
		fireEvent.click(screen.getByRole("button", { name: "创建" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(mockCreate).toHaveBeenCalledWith({
			title: "连接池",
			content_md: "正文",
			tags: [],
			journal,
		});

		setPaged([saved]);
		mockAdminNote.mockReturnValue({ data: saved, isLoading: false });
		page.rerender(<NotesAdminListPage />);
		fireEvent.click(screen.getByRole("button", { name: "连接池" }));
		expect(screen.getByRole("combobox", { name: "关联项目" }).textContent).toBe("Violet");
		expect(screen.getByRole("checkbox", { name: "已解决" }).getAttribute("aria-checked")).toBe(
			"true",
		);
		expect(screen.getByDisplayValue("defer conn.Close()")).toBe(
			screen.getByRole("textbox", { name: "代码" }),
		);
		expect(screen.getByRole("link", { name: "查看前台公开页" }).getAttribute("href")).toBe(
			"/journal/n-1",
		);
	});
});

describe("NoteEditor", () => {
	it("切换类型和清除关联后保存空值，并允许发布", async () => {
		const note: AdminNote = {
			...summary({ status: "draft", published_at: null }),
			content_md: "正文",
			content_html: "<p>正文</p>",
			journal: {
				type: "pitfall",
				project_id: "675a602f-f596-4f71-b8c5-80627c78d202",
				pitfall: {
					symptom: "旧现象",
					cause: "",
					remedy: "",
					resolved: false,
					code: "",
				},
			},
		};
		mockAdminNote.mockReturnValue({ data: note, isLoading: false });
		const editor = render(<NoteEditor id={note.id} />);
		expect(screen.getByDisplayValue("旧现象")).toBe(
			screen.getByRole("textbox", { name: "现象" }),
		);
		selectOption("类型", "想法");
		selectOption("关联项目", "不关联项目");
		expect(screen.queryByRole("textbox", { name: "现象" })).toBeNull();
		selectOption("类型", "踩坑");
		expect(screen.queryByDisplayValue("旧现象")).toBeNull();
		selectOption("类型", "想法");
		expect(screen.getByText(/未保存/)).toBeTruthy();

		// 同一笔记的后台刷新不能覆盖编辑中的类型或项目。
		mockAdminNote.mockReturnValue({ data: { ...note }, isLoading: false });
		editor.rerender(<NoteEditor id={note.id} />);
		expect(screen.getByRole("combobox", { name: "类型" }).textContent).toBe("想法");

		const journal = { type: "idea", project_id: null, pitfall: null } as const;
		mockSave.mockResolvedValue({ ...note, journal });
		mockPublish.mockResolvedValue({ ...note, journal, status: "published" });
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() => expect(screen.queryByText(/未保存/)).toBeNull());
		expect(mockSave).toHaveBeenCalledWith({
			title: note.title,
			content_md: "正文",
			tags: [],
			journal,
		});
		fireEvent.click(screen.getByRole("button", { name: "发布" }));
		expect(mockPublish).toHaveBeenCalledOnce();
	});
});
