import type { GalleryStatus, GallerySummary } from "@entities/gallery/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useCreateGalleryDraft, useDeleteGallery } from "@features/gallery-editor/api/mutations";
import { useAdminGalleries } from "@features/gallery-editor/api/queries";
import { GALLERY_STATUS_LABELS } from "@features/gallery-editor/model/status";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { SearchInput } from "@shared/ui/search-input";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "all", label: "全部状态" },
	...Object.entries(GALLERY_STATUS_LABELS).map(([value, label]) => ({
		value,
		label,
	})),
];

/** 图集管理列表与创建入口，支持按作者用户名与发布状态筛选。 */
export function GalleryDraftListPage() {
	const navigate = useNavigate();
	const canManage = useHasPermission("gallery:manage");
	const { data: me } = useMe();
	const [author, setAuthor] = useState("");
	const [status, setStatus] = useState("all");
	const [deleting, setDeleting] = useState<GallerySummary | null>(null);

	const createDraft = useCreateGalleryDraft();
	const deleteGallery = useDeleteGallery(deleting?.id ?? "", deleting?.slug ?? null);

	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(
		useAdminGalleries,
		{
			author: author || undefined,
			status: status === "all" ? undefined : (status as GalleryStatus),
		},
		{ initialPageSize: 20 },
	);

	const resetPage = () => setPage(1);

	const openDraft = (id: string) => {
		void navigate({ to: "/admin/galleries/$id", params: { id } });
	};

	const handleConfirmDelete = async () => {
		if (!deleting) return;
		try {
			await deleteGallery.mutateAsync({ expected_version: deleting.version });
			toast.success("图集已删除");
			setDeleting(null);
		} catch (deleteError) {
			toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
		}
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
					{row.title || `（未命名工作稿）${row.id.slice(0, 8)}`}
				</button>
			),
		},
		{
			key: "status",
			header: "状态",
			width: "110px",
			cell: (row) => (
				<Badge
					variant={
						row.status === "published"
							? "default"
							: row.status === "modified"
								? "secondary"
								: "outline"
					}
				>
					{GALLERY_STATUS_LABELS[row.status]}
				</Badge>
			),
		},
		{
			key: "author",
			header: "作者",
			width: "140px",
			ellipsis: true,
			cell: (row) => (
				<span className="text-sm">
					{row.author_name || row.author_id.slice(0, 8)}
					{me?.id === row.author_id ? (
						<span className="ml-1 text-xs text-muted-foreground">（我）</span>
					) : null}
				</span>
			),
		},
		{
			key: "item_count",
			header: "图片数",
			width: "90px",
			cell: (row) => <span className="font-mono text-sm tabular-nums">{row.item_count}</span>,
		},
		{
			key: "slug",
			header: "路径",
			width: "160px",
			ellipsis: true,
			cell: (row) => (
				<span className="font-mono text-xs text-muted-foreground">
					{row.slug ? `/galleries/${row.slug}` : "—"}
				</span>
			),
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
			width: "96px",
			sticky: "right",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={() => openDraft(row.id)}
									aria-label={`编辑图集 ${row.title || row.id.slice(0, 8)}`}
								>
									<Pencil className="size-3.5" />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>编辑</TooltipContent>
					</Tooltip>

					{canManage && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => setDeleting(row)}
										aria-label={`删除图集 ${row.title || row.id.slice(0, 8)}`}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>删除</TooltipContent>
						</Tooltip>
					)}
				</div>
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
		<TooltipProvider>
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
				sticky={
					<div className="flex flex-wrap items-center gap-3 pt-1">
						<div className="min-w-50 max-w-80 flex-1">
							<SearchInput
								defaultValue=""
								placeholder="按作者用户名筛选..."
								onSearch={(value) => {
									setAuthor(value.trim());
									resetPage();
								}}
							/>
						</div>
						<Select
							value={status}
							onValueChange={(value) => {
								setStatus(value);
								resetPage();
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
					emptyTitle="没有匹配的图集工作稿"
					emptyDescription="调整筛选条件，或创建新的空工作稿。"
				/>

				{/* 列表行级直接删除二次确认 */}
				<ConfirmDialog
					open={Boolean(deleting)}
					onOpenChange={(open) => {
						if (!open) setDeleting(null);
					}}
					onConfirm={() => void handleConfirmDelete()}
					title="确认删除图集"
					description={`确定要删除图集「${deleting?.title || deleting?.id.slice(0, 8) || ""}」吗？此操作将永久删除该图集及其所有图片，不可恢复。`}
					confirmLabel="删除"
					loading={deleteGallery.isPending}
				/>
			</PageShell>
		</TooltipProvider>
	);
}
