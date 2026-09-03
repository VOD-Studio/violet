import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useDeleteSeries } from "@features/admin-series/api/mutations";
import { useAdminSeries } from "@features/admin-series/api/queries";
import type { AdminSeriesListItem } from "@features/admin-series/model/types";
import { SeriesSheet } from "@features/admin-series/ui/SeriesSheet";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable, usePagedQuery } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/series/")({
	component: AdminSeriesPage,
});

function formatTime(s?: string): string {
	if (!s) return "—";
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("zh-CN");
}

function AdminSeriesPage() {
	const { data: paged, isLoading, error, refetch, pagination } = usePagedQuery(useAdminSeries);
	const items = paged?.data ?? [];
	const navigate = useNavigate({ from: "/admin/series" });

	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<AdminSeriesListItem | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState<AdminSeriesListItem | null>(null);
	const del = useDeleteSeries();

	const handleCreate = () => {
		setEditing(null);
		setSheetOpen(true);
	};
	const handleEditMeta = (row: AdminSeriesListItem) => {
		setEditing(row);
		setSheetOpen(true);
	};
	const handleDelete = (row: AdminSeriesListItem) => {
		setDeleting(row);
		setDeleteOpen(true);
	};
	const confirmDelete = () => {
		if (!deleting) return;
		del.mutate(deleting.id, {
			onSuccess: () => {
				setDeleteOpen(false);
				setDeleting(null);
			},
		});
	};

	const columns: DataTableColumn<AdminSeriesListItem>[] = [
		{
			key: "title",
			header: "书名",
			hideable: false,
			width: "28%",
			ellipsis: true,
			cell: (row) => <span className="font-medium">{row.title}</span>,
		},
		{
			key: "slug",
			header: "slug",
			width: "180px",
			ellipsis: true,
			cell: (row) => (
				<span className="text-muted-foreground font-mono text-sm">{row.slug}</span>
			),
		},
		{
			key: "status",
			header: "状态",
			sortable: true,
			width: "90px",
			cell: (row) => (
				<Badge variant={row.status === "published" ? "default" : "secondary"}>
					{row.status === "published" ? "已发布" : "草稿"}
				</Badge>
			),
		},
		{
			key: "chapters",
			header: "章节",
			sortable: true,
			width: "110px",
			cell: (row) => (
				<span className="text-muted-foreground text-sm">
					{row.chapter_count} / {row.total_chapter_count}
				</span>
			),
		},
		{
			key: "latest_chapter_at",
			header: "最近更新",
			sortable: true,
			width: "110px",
			cell: (row) => (
				<span className="text-muted-foreground text-sm">
					{formatTime(row.latest_chapter_at)}
				</span>
			),
		},
		{
			key: "created_at",
			header: "创建时间",
			sortable: true,
			width: "110px",
			cell: (row) => (
				<span className="text-muted-foreground text-sm">{formatTime(row.created_at)}</span>
			),
		},
		{
			key: "actions_col",
			header: "操作",
			width: "110px",
			cell: (row) => (
				<div className="flex items-center gap-1.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									size="icon-sm"
									variant="ghost"
									onClick={() =>
										void navigate({
											to: "/admin/series/$id",
											params: { id: row.id },
										})
									}
									aria-label={`目录管理《${row.title}》`}
								>
									<BookOpen className="size-3.5" />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>目录管理</TooltipContent>
					</Tooltip>
					<PermissionGuard permission="series:update">
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										size="icon-sm"
										variant="ghost"
										onClick={() => handleEditMeta(row)}
										aria-label={`编辑《${row.title}》信息`}
									>
										<Pencil className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>编辑信息</TooltipContent>
						</Tooltip>
					</PermissionGuard>
					<PermissionGuard permission="series:delete">
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										size="icon-sm"
										variant="ghost"
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => handleDelete(row)}
										aria-label={`解散《${row.title}》`}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>解散书</TooltipContent>
						</Tooltip>
					</PermissionGuard>
				</div>
			),
		},
	];

	return (
		<TooltipProvider>
			<PageShell
				title="系列书管理"
				description="把同主题渐进式文章组织成有章节顺序的书"
				action={
					<PermissionGuard permission="series:create">
						<Button size="sm" onClick={handleCreate}>
							<Plus className="size-3.5" />
							建书
						</Button>
					</PermissionGuard>
				}
			>
				<DataTable<AdminSeriesListItem>
					data={items}
					columns={columns}
					pagination={pagination}
					keyExtractor={(row) => row.id}
					selectable={false}
					loading={isLoading}
					error={error ? new Error(error.message) : null}
					onRetry={() => refetch()}
					storageKey="admin-series-columns"
					resizable
					caption="书列表"
					emptyTitle="还没有书"
					emptyDescription="建一本书，把已有文章挂成章节"
				/>
				<SeriesSheet
					open={sheetOpen}
					onOpenChange={setSheetOpen}
					editing={editing}
					onCreated={(id) => void navigate({ to: "/admin/series/$id", params: { id } })}
				/>
				<ConfirmDialog
					open={deleteOpen}
					onOpenChange={setDeleteOpen}
					onConfirm={confirmDelete}
					title="确认解散书"
					description={`解散《${deleting?.title}》将解绑全部章节，文章本身不受影响。确定解散吗？`}
					confirmLabel="解散"
					loading={del.isPending}
				/>
			</PageShell>
		</TooltipProvider>
	);
}
