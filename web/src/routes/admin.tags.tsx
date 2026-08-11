import type { Tag } from "@entities/tag/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { TagDialog } from "@features/admin-tags/ui/TagDialog";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { useDeleteTag } from "@features/tags/api/mutations";
import { useTags } from "@features/tags/api/queries";
import { Button } from "@shared/ui/base/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/tags")({
	component: AdminTagsPage,
});

function AdminTagsPage() {
	const { data: tags = [], isLoading, error, refetch } = useTags();
	const deleteTag = useDeleteTag();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<Tag | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState<Tag | null>(null);
	const [sort, setSort] = useState<DataTableSort | null>(null);

	const sortedTags = useMemo(() => {
		if (!sort) return tags;
		const copy = [...tags];
		copy.sort((a, b) => {
			const av = a[sort.key as keyof Tag];
			const bv = b[sort.key as keyof Tag];
			const cmp = String(av).localeCompare(String(bv), "zh");
			return sort.order === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [tags, sort]);

	// TODO: 标签管理当前无批量操作后端接口；如需复选框批量删除/合并，需后端支持。

	const handleEdit = (t: Tag) => {
		setEditing(t);
		setDialogOpen(true);
	};
	const handleCreate = () => {
		setEditing(null);
		setDialogOpen(true);
	};
	const handleDelete = (t: Tag) => {
		setDeleting(t);
		setDeleteOpen(true);
	};
	const confirmDelete = () => {
		if (!deleting?.id) return;
		deleteTag.mutate(deleting.id, {
			onSuccess: () => {
				setDeleteOpen(false);
				setDeleting(null);
			},
		});
	};

	const columns: DataTableColumn<Tag>[] = [
		{
			key: "name",
			header: "标签名",
			hideable: false,
			sortable: true,
			ellipsis: true,
			width: "200px",
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "slug",
			header: "Slug",
			sortable: true,
			ellipsis: true,
			cell: (row) => (
				<code className="font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
					{row.slug}
				</code>
			),
		},
		{
			key: "actions_col",
			header: "操作",
			sticky: "right",
			width: "96px",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<PermissionGuard permission="tag:update">
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => handleEdit(row)}
							title="编辑"
						>
							<Pencil className="size-3.5" />
						</Button>
					</PermissionGuard>
					<PermissionGuard permission="tag:delete">
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => handleDelete(row)}
							title="删除"
						>
							<Trash2 className="size-3.5" />
						</Button>
					</PermissionGuard>
				</div>
			),
		},
	];

	return (
		<PageShell
			title="标签管理"
			description="管理文章标签"
			action={
				<PermissionGuard permission="tag:create">
					<Button size="sm" onClick={handleCreate}>
						<Plus className="size-3.5" />
						创建标签
					</Button>
				</PermissionGuard>
			}
		>
			<DataTable<Tag>
				data={sortedTags}
				columns={columns}
				keyExtractor={(row) => String(row.id)}
				page={1}
				pageSize={sortedTags.length}
				total={sortedTags.length}
				onPageChange={() => {}}
				selectable={false}
				loading={isLoading}
				error={error ? new Error(error.message) : null}
				onRetry={() => refetch()}
				sort={sort}
				onSortChange={setSort}
				storageKey="admin-tags-columns"
				caption="标签列表"
				emptyTitle="暂无标签"
				emptyDescription="还没有创建任何标签"
			/>
			<TagDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={confirmDelete}
				title="确认删除标签"
				description={`确定要删除标签 ${deleting?.name} 吗？`}
				confirmLabel="删除"
				loading={deleteTag.isPending}
			/>
		</PageShell>
	);
}
