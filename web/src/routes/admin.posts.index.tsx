import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	useBatchAction,
	useDeletePost,
	useHardDeletePost,
	useRestorePost,
	useSetFeatured,
	useUpdatePostStatus,
} from "@features/admin-posts/api/mutations";
import { useAdminPosts } from "@features/admin-posts/api/queries";
import type { AdminPostListItem, PostBatchAction } from "@features/admin-posts/model/types";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useTags } from "@features/tags/api/queries";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { Input } from "@shared/ui/base/input";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { SearchInput } from "@shared/ui/search-input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Archive,
	ChevronDown,
	MoreHorizontal,
	Pencil,
	Plus,
	RotateCcw,
	Send,
	Star,
	StarOff,
	Tag,
	Trash2,
	Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Tag as TagEntity } from "@/entities/tag/model/types";
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

/** 批量操作 -> 中文动词，用于确认文案与 toast */
const BATCH_ACTION_LABEL: Record<PostBatchAction, string> = {
	delete: "删除",
	hard_delete: "彻底删除",
	publish: "发布",
	archive: "归档",
	feature: "加精",
	unfeature: "取消精选",
	restore: "恢复",
};

function AdminPostsPage() {
	const navigate = useNavigate();
	const [status, setStatus] = useState("all");

	const [keyword, setKeyword] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState<AdminPostListItem | null>(null);
	// 需二次确认的批量操作（delete / hard_delete）；其余操作直接执行
	const [pendingBulk, setPendingBulk] = useState<PostBatchAction | null>(null);

	const canCreate = useHasPermission("post:create");
	const { data: me } = useMe({ enabled: true });
	const { data: tags = [] } = useTags();
	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(
		useAdminPosts,
		{
			status: status === "all" ? undefined : status,
			keyword: keyword || undefined,
			tags: selectedTags.length > 0 ? selectedTags : undefined,
		},
		{ initialPageSize: PAGE_SIZE },
	);
	const deletePost = useDeletePost(deleting?.id ?? "");
	const hardDeletePost = useHardDeletePost(deleting?.id ?? "");
	const batchMut = useBatchAction();

	const posts = data?.data ?? [];

	const handleStatusChange = (v: string) => {
		setStatus(v);
		setPage(1);
		setSelectedIds(new Set());
	};

	// 搜索 / 标签筛选改变时重置分页与选中（数据集已变）
	const handleSearch = (v: string) => {
		setKeyword(v);
		setPage(1);
		setSelectedIds(new Set());
	};
	const handleTagsChange = (slugs: string[]) => {
		setSelectedTags(slugs);
		setPage(1);
		setSelectedIds(new Set());
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

	// 直接执行的批量操作（无需二次确认）
	const runBulk = (action: PostBatchAction) => {
		if (selectedIds.size === 0) return;
		batchMut.mutate(
			{ ids: [...selectedIds], action },
			{
				onSuccess: (res) => {
					toast.success(`已${BATCH_ACTION_LABEL[action]} ${res.affected} 篇文章`);
					setSelectedIds(new Set());
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	// 二次确认后执行的批量删除 / 彻底删除
	const confirmBulk = () => {
		if (!pendingBulk || selectedIds.size === 0) return;
		batchMut.mutate(
			{ ids: [...selectedIds], action: pendingBulk },
			{
				onSuccess: (res) => {
					toast.success(`已${BATCH_ACTION_LABEL[pendingBulk]} ${res.affected} 篇文章`);
					setSelectedIds(new Set());
					setPendingBulk(null);
				},
				onError: (err) => toast.error(err.message),
			},
		);
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
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<div className="min-w-50 max-w-80 flex-1">
						<SearchInput
							defaultValue=""
							placeholder="搜索标题 / 正文..."
							onSearch={handleSearch}
						/>
					</div>
					<Select value={status} onValueChange={handleStatusChange}>
						<SelectTrigger className="h-9 w-36">
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
					<TagFilter tags={tags} selected={selectedTags} onChange={handleTagsChange} />
				</div>
			}
		>
			<DataTable<AdminPostListItem>
				data={posts}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				selectable
				selectedIds={selectedIds}
				onSelectionChange={setSelectedIds}
				bulkActions={
					status === "trashed" ? (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => runBulk("restore")}
								disabled={batchMut.isPending}
							>
								<RotateCcw className="size-3.5" />
								恢复
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setPendingBulk("hard_delete")}
								disabled={batchMut.isPending}
							>
								<Trash2 className="size-3.5" />
								彻底删除
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => runBulk("publish")}
								disabled={batchMut.isPending}
							>
								<Send className="size-3.5" />
								发布
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => runBulk("archive")}
								disabled={batchMut.isPending}
							>
								<Archive className="size-3.5" />
								归档
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => runBulk("feature")}
								disabled={batchMut.isPending}
							>
								<Star className="size-3.5" />
								加精
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => runBulk("unfeature")}
								disabled={batchMut.isPending}
							>
								<StarOff className="size-3.5" />
								取消精选
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setPendingBulk("delete")}
								disabled={batchMut.isPending}
							>
								<Trash2 className="size-3.5" />
								删除
							</Button>
						</>
					)
				}
				loading={isLoading}
				error={error ? new Error(error.message) : null}
				onRetry={() => refetch()}
				filtered={keyword.trim().length > 0 || selectedTags.length > 0}
				rowClassName={(row) => (row.is_featured ? "bg-primary/5" : "")}
				storageKey="admin-posts-columns"
				caption="文章列表"
				emptyTitle="暂无文章"
				emptyDescription="还没有发布任何文章"
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
			<ConfirmDialog
				open={pendingBulk !== null}
				onOpenChange={(open) => !open && setPendingBulk(null)}
				onConfirm={confirmBulk}
				title={pendingBulk === "hard_delete" ? "确认彻底删除" : "确认删除"}
				description={
					pendingBulk === "hard_delete"
						? `确定要彻底删除选中的 ${selectedIds.size} 篇文章吗？此操作无法恢复！`
						: `确定要删除选中的 ${selectedIds.size} 篇文章吗？文章将移至回收站，后续可恢复。`
				}
				confirmLabel={pendingBulk === "hard_delete" ? "彻底删除" : "删除"}
				loading={batchMut.isPending}
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

/**
 * TagFilter - 标签多选筛选器
 *
 * Popover + 复选框列表实现（项目无现成 Combobox）。
 * 值为标签 slug 列表，AND 关系由后端过滤。
 */
function TagFilter({
	tags,
	selected,
	onChange,
}: {
	tags: TagEntity[];
	selected: string[];
	onChange: (slugs: string[]) => void;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return tags;
		return tags.filter(
			(t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
		);
	}, [tags, query]);

	const toggle = (slug: string) => {
		onChange(
			selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug],
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" className="h-9 gap-1.5">
					<Tag className="size-3.5" />
					{selected.length > 0 ? `标签 (${selected.length})` : "标签筛选"}
					<ChevronDown className="size-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-60 p-0" align="start">
				<div className="border-b p-2">
					<Input
						placeholder="搜索标签..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="h-8"
					/>
				</div>
				<div className="max-h-60 overflow-y-auto p-1">
					{filtered.length === 0 ? (
						<p className="text-muted-foreground px-3 py-4 text-center text-sm">
							无匹配标签
						</p>
					) : (
						filtered.map((t) => {
							const checked = selected.includes(t.slug);
							return (
								<button
									key={t.id}
									type="button"
									className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
									onClick={() => toggle(t.slug)}
								>
									<Checkbox
										checked={checked}
										tabIndex={-1}
										className="pointer-events-none"
									/>
									<span className="flex-1 truncate">{t.name}</span>
									<span className="text-muted-foreground shrink-0 text-xs">
										{t.slug}
									</span>
								</button>
							);
						})
					)}
				</div>
				{selected.length > 0 ? (
					<div className="border-t p-2">
						<Button
							variant="ghost"
							size="sm"
							className="w-full"
							onClick={() => onChange([])}
						>
							清除全部
						</Button>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function formatTime(s?: string): string {
	if (!s) return "—";
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return s;
	return d.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}
