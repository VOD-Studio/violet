import type { GallerySummary } from "@entities/gallery/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useCreateGalleryDraft } from "@features/gallery-editor/api/mutations";
import { useAdminGalleries } from "@features/gallery-editor/api/queries";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

/** 当前作者的工作稿列表与创建入口。 */
export function GalleryDraftListPage() {
	const navigate = useNavigate();
	const canManage = useHasPermission("gallery:manage");
	const createDraft = useCreateGalleryDraft();
	const { data, isLoading, error, refetch, pagination } = usePagedQuery(
		useAdminGalleries,
		{},
		{ initialPageSize: 20 },
	);

	const openDraft = (id: string) => {
		void navigate({ to: "/admin/galleries/$id", params: { id } });
	};

	const columns: DataTableColumn<GallerySummary>[] = [
		{
			key: "title",
			header: "标题",
			hideable: false,
			ellipsis: true,
			cell: (row) => (
				<button
					type="button"
					className="text-left font-medium hover:text-primary hover:underline"
					onClick={() => openDraft(row.id)}
				>
					{row.title || "未命名图集"}
				</button>
			),
		},
		{
			key: "status",
			header: "状态",
			width: "100px",
			cell: (row) => (
				<Badge variant={row.status === "published" ? "default" : "secondary"}>
					{row.status === "published" ? "已发布" : "工作稿"}
				</Badge>
			),
		},
		{
			key: "item_count",
			header: "图片",
			width: "80px",
			align: "right",
			cell: (row) => <span className="tabular-nums">{row.item_count}</span>,
		},
		{
			key: "version",
			header: "版本",
			width: "80px",
			align: "right",
			cell: (row) => <span className="tabular-nums">v{row.version}</span>,
		},
		{
			key: "updated_at",
			header: "更新时间",
			width: "180px",
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{dateFormatter.format(new Date(row.updated_at))}
				</span>
			),
		},
		{
			key: "actions",
			header: "操作",
			width: "100px",
			sticky: "right",
			cell: (row) => (
				<Button variant="ghost" size="sm" onClick={() => openDraft(row.id)}>
					编辑
				</Button>
			),
		},
	];

	const handleCreate = async () => {
		try {
			const created = await createDraft.mutateAsync();
			await navigate({ to: "/admin/galleries/$id", params: { id: created.id } });
		} catch (createError) {
			toast.error(createError instanceof Error ? createError.message : "创建工作稿失败");
		}
	};

	return (
		<PageShell
			title="图集管理"
			description="创建和编辑图片工作稿"
			action={
				canManage ? (
					<Button
						size="sm"
						disabled={createDraft.isPending}
						onClick={() => void handleCreate()}
					>
						{createDraft.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
						新建工作稿
					</Button>
				) : null
			}
		>
			<DataTable<GallerySummary>
				data={data?.data ?? []}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error}
				onRetry={() => void refetch()}
				storageKey="admin-galleries"
				caption="图集工作稿列表"
				emptyTitle="还没有图集工作稿"
				emptyDescription="创建空工作稿后，再添加图片和文字。"
			/>
		</PageShell>
	);
}
