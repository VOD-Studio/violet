import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	useDeletePost,
	useHardDeletePost,
	useRestorePost,
	useSetFeatured,
	useUpdatePostStatus,
} from "@features/admin-posts/api/mutations";
import { useAdminPosts } from "@features/admin-posts/api/queries";
import type { AdminPostListItem } from "@features/admin-posts/model/types";
import { ConfirmDialog } from "@shared/ui/confirm-dialog"
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Archive,
	ChevronDown,
	MoreHorizontal,
	Pencil,
	Plus,
	Star,
	Trash2,
	Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";

/**
 * /admin/posts - 文章管理列表页
 *
 * 复用 PageShell + DataTable：标题 / 状态 Badge / 浏览量 / 标签 / 发布时间 / 操作。
 * 顶部「新建文章」跳转编辑器全屏页；状态筛选 + 服务端分页。
 */
export const Route = createFileRoute("/admin/posts/")({
	component: AdminPostsPage,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> =
	{
		draft: { label: "草稿", variant: "secondary" },
		published: { label: "已发布", variant: "default" },
		archived: { label: "已归档", variant: "outline" },
	};

const STATUS_OPTIONS = [
	{ value: "all", label: "全部状态" },
	{ value: "draft", label: "草稿" },
	{ value: "published", label: "已发布" },
	{ value: "archived", label: "已归档" },
	{ value: "trashed", label: "回收站" },
];

const PAGE_SIZE = 10;

// TODO: 文章列表当前无排序能力；后端 /admin/posts 需支持 sort_by + order 查询参数。
// TODO: 文章管理缺少批量操作后端接口（批量删除、批量发布、批量归档、批量加精）。

function AdminPostsPage() {
	const navigate = useNavigate();
	const [status, setStatus] = useState("all");
	const [page, setPage] = useState(1);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState<AdminPostListItem | null>(null);

	const canCreate = useHasPermission("post:create");
	const { data: me } = useMe({ enabled: true });

	const { data, isLoading, error, refetch } = useAdminPosts({
		page,
		limit: PAGE_SIZE,
		status: status === "all" ? undefined : status,
	});
	const deletePost = useDeletePost(deleting?.id ?? "");
	const hardDeletePost = useHardDeletePost(deleting?.id ?? "");

	const posts = data?.data ?? [];
	const total = data?.pagination?.total ?? 0;

	const handleStatusChange = (v: string) => {
		setStatus(v);
		setPage(1);
	};

	const confirmDelete = () => {
		if (!deleting?.id) return;
		const mutation = status === "trashed" ? hardDeletePost : deletePost;
		mutation.mutate(undefined, {
			onSuccess: () => {
				toast.success(status === "trashed" ? "文章已彻底删除" : "文章已移至回收站");
				setDeleteOpen(false);
				setDeleting(null);
			},
			onError: (err) => toast.error(err.message),
		});
	};

	const columns: DataTableColumn<AdminPostListItem>[] = [
		{
			key: "title",
			header: "标题",
			hideable: false,
			sortable: false,
			ellipsis: true,
			cell: (row) => (
				<button
					type="button"
					onClick={() =>
						navigate({
							to: "/admin/posts/$id",
							params: { id: row.id },
							state: { post: row } as Record<string, unknown>,
						})
					}
					className="font-medium text-left hover:text-primary hover:underline"
				>
					{row.title}
				</button>
			),
		},
		{
			key: "status",
			header: "状态",
			width: "100px",
			cell: (row) => {
				if (status === "trashed") {
					return <Badge variant="destructive">已删除</Badge>;
				}
				const meta = STATUS_META[row.status] ?? {
					label: row.status,
					variant: "outline" as const,
				};
				return <Badge variant={meta.variant}>{meta.label}</Badge>;
			},
		},
		{
			key: "is_featured",
			header: "精选",
			width: "80px",
			align: "center",
			cell: (row) =>
				row.is_featured ? (
					<Badge variant="default">
						<Star className="size-3" />
						精选
					</Badge>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
		},
		{
			key: "tags",
			header: "标签",
			cell: (row) =>
				row.tags.length > 0 ? (
					<div className="flex flex-wrap gap-1">
						{row.tags.slice(0, 3).map((t) => (
							<Badge key={t} variant="outline" className="text-[10px]">
								{t}
							</Badge>
						))}
						{row.tags.length > 3 ? (
							<span className="text-xs text-muted-foreground">
								+{row.tags.length - 3}
							</span>
						) : null}
					</div>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
		},
		{
			key: "view_count",
			header: "浏览",
			width: "80px",
			align: "right",
			cell: (row) => <span className="tabular-nums">{row.view_count}</span>,
		},
		{
			key: "published_at",
			header: "发布时间",
			width: "160px",
			cell: (row) => {
				if (!row.published_at)
					return <span className="text-xs text-muted-foreground">未发布</span>;
				return (
					<span className="text-xs text-muted-foreground">
						{formatTime(row.published_at)}
					</span>
				);
			},
		},
		{
			key: "actions_col",
			header: "操作",
			sticky: "right",
			width: "120px",
			cell: (row) => (
				<RowActions
					row={row}
					viewStatus={status}
					currentUserId={me?.id}
					onDelete={(p) => {
						setDeleting(p);
						setDeleteOpen(true);
					}}
				/>
			),
		},
	];

	return (
		<PageShell
			title="文章管理"
			description="撰写、发布与管理博客文章"
			action={
				canCreate ? (
					<Button size="sm" onClick={() => navigate({ to: "/admin/posts/new" })}>
						<Plus className="size-3.5" />
						新建文章
					</Button>
				) : null
			}
			sticky={
				<div className="pt-1">
					<Select value={status} onValueChange={handleStatusChange}>
						<SelectTrigger className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			}
		>
			<DataTable<AdminPostListItem>
				data={posts}
				columns={columns}
				keyExtractor={(row) => row.id}
				page={page}
				pageSize={PAGE_SIZE}
				total={total}
				onPageChange={setPage}
				selectable={false}
				loading={isLoading}
				error={error ? new Error(error.message) : null}
				onRetry={() => refetch()}
				rowClassName={(row) => (row.is_featured ? "bg-primary/5" : "")}
				storageKey="admin-posts-columns"
				caption="文章列表"
				emptyTitle="暂无文章"
				emptyDescription="点击右上角「新建文章」开始创作"
			/>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={confirmDelete}
				title="确认删除文章"
				description={
					status === "trashed"
						? `确定要彻底删除文章「${deleting?.title}」吗？此操作无法恢复！`
						: `确定要删除文章「${deleting?.title}」吗？文章将移至回收站，后续可恢复。`
				}
				confirmLabel={status === "trashed" ? "彻底删除" : "删除"}
				loading={status === "trashed" ? hardDeletePost.isPending : deletePost.isPending}
			/>
		</PageShell>
	);
}

/** 行操作下拉：编辑 / 状态切换 / 删除 */
function RowActions({
	row,
	viewStatus,
	currentUserId,
	onDelete,
}: {
	row: AdminPostListItem;
	viewStatus: string;
	currentUserId?: string;
	onDelete: (p: AdminPostListItem) => void;
}) {
	const navigate = useNavigate();
	const updateStatus = useUpdatePostStatus(row.id);
	const setFeatured = useSetFeatured(row.id);
	const restorePost = useRestorePost(row.id);

	// 所有权：自己的文章可以编辑/删除/发布（后端应用层放行）
	const isOwner = !!row.author_id && row.author_id === currentUserId;
	// 权限码：操作他人的文章需要对应权限
	const hasUpdate = useHasPermission("post:update");
	const hasPublish = useHasPermission("post:publish");
	const hasDelete = useHasPermission("post:delete");

	// 实际可用 = 所有权放行 OR 权限码放行（加精/硬删仅权限码，不含所有权）
	const canEdit = isOwner || hasUpdate;
	const canPublish = isOwner || hasPublish;
	const canDelete = isOwner || hasDelete;
	// 加精是运营动作，仅权限码
	const canFeature = hasPublish;
	// 硬删不可恢复，仅权限码
	const canHardDelete = hasDelete;

	const changeStatus = (status: "draft" | "published" | "archived") => {
		updateStatus.mutate(
			{ status },
			{
				onSuccess: () => toast.success("状态已更新"),
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const toggleFeatured = () => {
		setFeatured.mutate(
			{ is_featured: !row.is_featured },
			{
				onSuccess: () => toast.success(row.is_featured ? "已取消加精" : "已加精"),
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleRestore = () => {
		restorePost.mutate(undefined, {
			onSuccess: () => toast.success("文章已恢复"),
			onError: (err) => toast.error(err.message),
		});
	};

	if (viewStatus === "trashed") {
		return (
			<div className="flex items-center justify-end gap-1">
				{canDelete ? (
					<Button
						variant="ghost"
						size="icon-sm"
						title="恢复"
						onClick={handleRestore}
						disabled={restorePost.isPending}
					>
						<Undo2 className="size-3.5" />
					</Button>
				) : null}
				{canHardDelete ? (
					<Button
						variant="ghost"
						size="icon-sm"
						title="彻底删除"
						className="hover:bg-destructive/10 hover:text-destructive"
						onClick={() => onDelete(row)}
					>
						<Trash2 className="size-3.5" />
					</Button>
				) : null}
			</div>
		);
	}

	// 无任何写权限时不渲染下拉触发器
	if (!canEdit && !canPublish && !canDelete && !canFeature) return null;

	return (
		<div className="flex items-center justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						title="更多操作"
						className="w-auto min-w-8 px-1.5"
					>
						<MoreHorizontal />
						<ChevronDown className="size-3 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{canEdit ? (
						<DropdownMenuItem
							onClick={() =>
								navigate({
									to: "/admin/posts/$id",
									params: { id: row.id },
									state: { post: row } as Record<string, unknown>,
								})
							}
						>
							<Pencil className="size-3.5" />
							编辑
						</DropdownMenuItem>
					) : null}
					{canPublish ? (
						<>
							<DropdownMenuSeparator />
							{row.status !== "published" ? (
								<DropdownMenuItem onClick={() => changeStatus("published")}>
									发布
								</DropdownMenuItem>
							) : null}
							{row.status !== "draft" ? (
								<DropdownMenuItem onClick={() => changeStatus("draft")}>
									移至草稿
								</DropdownMenuItem>
							) : null}
							{row.status !== "archived" ? (
								<DropdownMenuItem onClick={() => changeStatus("archived")}>
									<Archive className="size-3.5" />
									归档
								</DropdownMenuItem>
							) : null}
						</>
					) : null}
					{canFeature ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={toggleFeatured}>
								<Star className="size-3.5" />
								{row.is_featured ? "取消加精" : "加精"}
							</DropdownMenuItem>
						</>
					) : null}
					{canDelete ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
								<Trash2 className="size-3.5" />
								删除
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function formatTime(s?: string): string {
	if (!s) return "—";
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return s;
	return d.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}
