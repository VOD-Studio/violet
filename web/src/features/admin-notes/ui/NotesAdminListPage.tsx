import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminNotes as useAdminNotesQuery } from "@features/admin-notes/api/queries";
import type { AdminNoteSummary, NoteStatus } from "@features/admin-notes/model/types";
import { NOTE_STATUS_LABELS } from "@features/admin-notes/model/types";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { NoteSheet } from "./NoteSheet";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "all", label: "全部状态" },
	...Object.entries(NOTE_STATUS_LABELS).map(([value, label]) => ({
		value,
		label,
	})),
];

function formatTime(iso: string | null): string {
	return iso ? dateFormatter.format(new Date(iso)) : "—";
}

/** 笔记管理列表：状态筛选 + 新建/编辑侧滑抽屉。 */
export function NotesAdminListPage() {
	const canManage = useHasPermission("note:manage");
	const [status, setStatus] = useState("all");
	// undefined: 抽屉关闭; null: 新建笔记; string: 编辑指定笔记
	const [activeNoteId, setActiveNoteId] = useState<string | null | undefined>(undefined);

	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(
		useAdminNotesQuery,
		{ status: status === "all" ? undefined : (status as NoteStatus) },
		{ initialPageSize: 20 },
	);

	const openCreate = () => setActiveNoteId(null);
	const openEdit = (id: string) => setActiveNoteId(id);

	const columns: DataTableColumn<AdminNoteSummary>[] = [
		{
			key: "title",
			header: "标题",
			hideable: false,
			ellipsis: true,
			cell: (row) => (
				<div className="min-w-0">
					<button
						type="button"
						className="text-left font-medium hover:text-primary hover:underline"
						onClick={() => openEdit(row.id)}
					>
						{row.title || `（无标题）${row.id.slice(0, 8)}`}
					</button>
					{row.tags.length > 0 ? (
						<p className="text-muted-foreground/70 mt-0.5 truncate font-mono text-[11px]">
							{row.tags.join(" / ")}
						</p>
					) : null}
				</div>
			),
		},
		{
			key: "status",
			header: "状态",
			width: "96px",
			cell: (row) => (
				<Badge variant="outline" className="gap-1.5">
					<span
						className={
							row.status === "published"
								? "size-1.5 rounded-full bg-emerald-500"
								: "size-1.5 rounded-full bg-muted-foreground/40"
						}
					/>
					{NOTE_STATUS_LABELS[row.status]}
				</Badge>
			),
		},
		{
			key: "time",
			header: "时间",
			width: "170px",
			cell: (row) => (
				<div>
					<p className="text-muted-foreground tabular-nums text-xs">
						{formatTime(row.published_at ?? row.created_at)}
					</p>
					<p className="text-muted-foreground/50 mt-0.5 font-mono text-[10px]">
						{row.published_at ? "published" : "created"}
					</p>
				</div>
			),
		},
		{
			key: "actions",
			header: "操作",
			width: "80px",
			sticky: "right",
			cell: (row) => (
				<Button variant="ghost" size="sm" onClick={() => openEdit(row.id)}>
					编辑
				</Button>
			),
		},
	];

	return (
		<PageShell
			title="笔记管理"
			description="创建、编辑与发布知识笔记"
			action={
				canManage ? (
					<Button size="sm" onClick={openCreate}>
						<Plus className="size-4" />
						新建笔记
					</Button>
				) : null
			}
			sticky={
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<Select
						value={status}
						onValueChange={(value) => {
							setStatus(value);
							setPage(1);
						}}
					>
						<SelectTrigger className="h-9 w-36" aria-label="状态筛选">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_FILTER_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			}
		>
			<DataTable<AdminNoteSummary>
				data={data?.data ?? []}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error}
				onRetry={() => void refetch()}
				storageKey="admin-notes"
				caption="笔记管理列表"
				emptyTitle="还没有笔记"
				emptyDescription="新建一条笔记，或等 AI 会话沉淀进来"
			/>

			{/* 新建与快速编辑侧滑抽屉 */}
			<NoteSheet
				open={activeNoteId !== undefined}
				onOpenChange={(open) => {
					if (!open) setActiveNoteId(undefined);
				}}
				noteId={activeNoteId}
			/>
		</PageShell>
	);
}
