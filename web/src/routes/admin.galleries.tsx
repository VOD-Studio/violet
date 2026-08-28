import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useDeleteGallery, useSetGalleryStatus } from "@features/galleries/api/mutations";
import { useAdminGalleries } from "@features/galleries/api/queries";
import type { GallerySummary } from "@features/galleries/model/types";
import { ApiError } from "@shared/api/error";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Ban, Images, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** 错误 → toast：治理操作失败把后端原因暴露给管理员 */
function toastError(err: unknown, fallback: string) {
	toast.error(err instanceof ApiError ? err.message : fallback);
}

import { Badge } from "@/shared/ui/base/badge";
import { Button } from "@/shared/ui/base/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

function AdminGalleriesPage() {
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const { data, isLoading, error, refetch, pagination } = usePagedQuery(useAdminGalleries);
	const statusMut = useSetGalleryStatus();
	const deleteMut = useDeleteGallery();
	const canManage = useHasPermission("gallery:delete-any");

	const columns: DataTableColumn<GallerySummary>[] = [
		{
			key: "title",
			header: "标题",
			hideable: false,
			ellipsis: true,
			cell: (row) => (
				<div className="flex items-center gap-2.5">
					{row.cover_url ? (
						<img
							src={contentImageUrl(row.cover_url, { width: 80 })}
							alt=""
							className="size-8 shrink-0 rounded object-cover"
							loading="lazy"
						/>
					) : (
						<span className="flex size-8 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
							<Images className="size-4" />
						</span>
					)}
					{row.status === "published" ? (
						<Link
							to="/galleries/$id"
							params={{ id: row.id }}
							className="text-sm text-primary hover:underline"
						>
							{row.title}
						</Link>
					) : (
						// removed 的公开详情 404，标题不做链接
						<span className="text-sm">{row.title}</span>
					)}
				</div>
			),
		},
		{
			key: "author",
			header: "作者",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<img
						src={avatarUrl(row.author.avatar_url, row.author.username)}
						alt={row.author.username}
						className="size-6 shrink-0 rounded-full object-cover"
						loading="lazy"
					/>
					<span className="text-sm">{row.author.username}</span>
				</div>
			),
		},
		{
			key: "item_count",
			header: "项数",
			width: "80px",
			cell: (row) => <span className="text-sm tabular-nums">{row.item_count}</span>,
		},
		{
			key: "status",
			header: "状态",
			width: "90px",
			cell: (row) =>
				row.status === "removed" ? (
					<Badge variant="destructive">已下架</Badge>
				) : (
					<Badge>已发布</Badge>
				),
		},
		{
			key: "created_at",
			header: "创建时间",
			width: "130px",
			cell: (row) => format(new Date(row.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }),
		},
		{
			key: "_actions",
			header: "操作",
			sticky: "right",
			width: "120px",
			cell: (row) =>
				canManage ? (
					<div className="flex items-center gap-1">
						{row.status === "published" ? (
							<Button
								size="icon-sm"
								variant="ghost"
								title="下架（前台立即 404，可恢复）"
								onClick={() =>
									statusMut.mutate(
										{ id: row.id, status: "removed" },
										{ onError: (e) => toastError(e, "下架失败") },
									)
								}
								disabled={statusMut.isPending}
							>
								<Ban className="size-3.5" />
							</Button>
						) : (
							<Button
								size="icon-sm"
								variant="ghost"
								title="恢复展示"
								onClick={() =>
									statusMut.mutate(
										{ id: row.id, status: "published" },
										{ onError: (e) => toastError(e, "恢复失败") },
									)
								}
								disabled={statusMut.isPending}
							>
								<RotateCcw className="size-3.5" />
							</Button>
						)}
						<Button
							size="icon-sm"
							variant="ghost"
							title="删除（物理删，不可恢复）"
							className="hover:bg-destructive/10 hover:text-destructive"
							onClick={() => setDeletingId(row.id)}
							disabled={deleteMut.isPending}
						>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				) : null,
		},
	];

	return (
		<PageShell title="图集管理" description="下架违规图集与恢复展示">
			<DataTable<GallerySummary>
				data={data?.data ?? []}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error ? new Error(error.message) : null}
				onRetry={() => refetch()}
				storageKey="admin-galleries-columns"
				caption="图集列表"
				emptyTitle="暂无图集"
				emptyDescription="还没有任何图集"
			/>

			<ConfirmDialog
				open={!!deletingId}
				onOpenChange={(open) => !open && setDeletingId(null)}
				onConfirm={() => {
					if (deletingId)
						deleteMut.mutate(deletingId, { onError: (e) => toastError(e, "删除失败") });
					setDeletingId(null);
				}}
				title="确认删除图集"
				description="删除将物理移除图集及其媒体引用（文件本身保留在素材库），此操作不可恢复。"
				confirmLabel="删除"
				loading={deleteMut.isPending}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/galleries")({
	component: AdminGalleriesPage,
});
