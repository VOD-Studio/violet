import {
	useApproveFriendLink,
	useCreateFriendLink,
	useDeleteFriendLink,
	useDisableFriendLink,
	useFriendLinks,
	useRejectFriendLink,
	useRestoreFriendLink,
	useUpdateFriendLink,
} from "@features/admin-friend-links/api/queries";
import type {
	FriendLinkAdminDTO,
	FriendLinkManualRequest,
	FriendLinkStatus,
} from "@features/admin-friend-links/model/types";
import { FriendLinkCell } from "@features/admin-friend-links/ui/FriendLinkCell";
import { FriendLinkFormDialog } from "@features/admin-friend-links/ui/FriendLinkFormDialog";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, ExternalLink, EyeOff, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

/** 筛选值："all" 表示全部，其余为具体状态 */
type FriendLinkFilter = "all" | FriendLinkStatus;

/** 状态分段配置（"全部" + 四种状态） */
const STATUS_SEGMENTS: SegmentedItem<FriendLinkFilter>[] = [
	{ value: "all", label: "全部" },
	{ value: "pending", label: "待审核" },
	{ value: "approved", label: "已通过" },
	{ value: "rejected", label: "已拒绝" },
	{ value: "disabled", label: "已下柜" },
];

/** 状态 -> 徽标文案与样式 */
const STATUS_BADGE: Record<
	FriendLinkStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	pending: { label: "待审核", variant: "secondary" },
	approved: { label: "已通过", variant: "default" },
	rejected: { label: "已拒绝", variant: "destructive" },
	disabled: { label: "已下柜", variant: "outline" },
};

function AdminFriendLinksPage() {
	const [filter, setFilter] = useState<FriendLinkFilter>("pending");
	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<FriendLinkAdminDTO | null>(null);
	const [deleting, setDeleting] = useState<FriendLinkAdminDTO | null>(null);

	// "all" -> 不传 status（查全部）；其余直接作为筛选值透传后端。
	const status: FriendLinkStatus | undefined = filter === "all" ? undefined : filter;

	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(useFriendLinks, {
		status,
	});
	const approveMut = useApproveFriendLink();
	const rejectMut = useRejectFriendLink();
	const disableMut = useDisableFriendLink();
	const restoreMut = useRestoreFriendLink();
	const createMut = useCreateFriendLink();
	const updateMut = useUpdateFriendLink();
	const deleteMut = useDeleteFriendLink();

	const canManage = useHasPermission("friendlink:manage");

	const switchFilter = (f: FriendLinkFilter) => {
		setFilter(f);
		setPage(1);
	};

	const columns: DataTableColumn<FriendLinkAdminDTO>[] = [
		{
			key: "name",
			header: "站点",
			hideable: false,
			cell: (row) => <FriendLinkCell row={row} />,
		},
		{
			key: "status",
			header: "状态",
			width: "100px",
			cell: (row) => (
				<Badge variant={STATUS_BADGE[row.status].variant}>
					{STATUS_BADGE[row.status].label}
				</Badge>
			),
		},
		{
			key: "owner_name",
			header: "站长 / 邮箱",
			cell: (row) =>
				row.owner_name || row.contact_email ? (
					<div className="min-w-0">
						<div className="truncate text-sm">{row.owner_name || "—"}</div>
						<div className="truncate text-xs text-muted-foreground">
							{row.contact_email || "—"}
						</div>
					</div>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			key: "linkback_url",
			header: "回链页",
			ellipsis: true,
			tooltip: (row) => row.linkback_url,
			cell: (row) =>
				row.linkback_url ? (
					<a
						href={row.linkback_url}
						target="_blank"
						rel="noreferrer"
						className="inline-flex max-w-full items-center gap-1 text-sm text-primary hover:underline"
					>
						<span className="truncate">{row.linkback_url}</span>
						<ExternalLink className="size-3 shrink-0" />
					</a>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			key: "sort_order",
			header: "排序",
			width: "70px",
			align: "center",
			accessorKey: "sort_order",
		},
		{
			key: "created_at",
			header: "创建时间",
			width: "110px",
			cell: (row) =>
				format(new Date(row.created_at), "MM-dd HH:mm", {
					locale: zhCN,
				}),
		},
		{
			key: "_actions",
			header: "操作",
			hideable: false,
			sticky: "right",
			width: "176px",
			align: "center",
			cell: (row) =>
				canManage ? (
					<div className="flex justify-center gap-1">
						{/* 按状态显隐审核操作：pending 批准/拒绝；approved 下柜；
							disabled 恢复；rejected 可改判批准（误拒纠正，PRD US16） */}
						{row.status === "pending" || row.status === "rejected" ? (
							<Button
								variant="ghost"
								size="icon-sm"
								title={row.status === "rejected" ? "改判为通过" : "批准"}
								disabled={approveMut.isPending}
								onClick={() => approveMut.mutate(row.id)}
							>
								<Check className="size-3.5" />
							</Button>
						) : null}
						{row.status === "pending" ? (
							<Button
								variant="ghost"
								size="icon-sm"
								title="拒绝"
								disabled={rejectMut.isPending}
								onClick={() => rejectMut.mutate(row.id)}
							>
								<X className="size-3.5" />
							</Button>
						) : null}
						{row.status === "approved" ? (
							<Button
								variant="ghost"
								size="icon-sm"
								title="下柜"
								disabled={disableMut.isPending}
								onClick={() => disableMut.mutate(row.id)}
							>
								<EyeOff className="size-3.5" />
							</Button>
						) : null}
						{row.status === "disabled" ? (
							<Button
								variant="ghost"
								size="icon-sm"
								title="恢复"
								disabled={restoreMut.isPending}
								onClick={() => restoreMut.mutate(row.id)}
							>
								<RotateCcw className="size-3.5" />
							</Button>
						) : null}
						{/* 全部状态可编辑/删除 */}
						<Button
							variant="ghost"
							size="icon-sm"
							title="编辑"
							onClick={() => setEditing(row)}
						>
							<Pencil className="size-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							title="删除"
							className="hover:bg-destructive/10 hover:text-destructive"
							onClick={() => setDeleting(row)}
						>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				) : null,
		},
	];

	return (
		<PageShell
			title="友链管理"
			description="审核与管理站点友链"
			action={
				canManage ? (
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="size-3.5" />
						手动添加
					</Button>
				) : null
			}
			sticky={
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<Segmented
						value={filter}
						onValueChange={switchFilter}
						segments={STATUS_SEGMENTS}
						size="default"
					/>
				</div>
			}
		>
			<DataTable<FriendLinkAdminDTO>
				data={data?.data ?? []}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error ? new Error(error.message) : null}
				onRetry={() => refetch()}
				storageKey="admin-friend-links-columns"
				caption="友链列表"
				emptyTitle="暂无友链"
				emptyDescription="当前状态下没有友链"
			/>

			<FriendLinkFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				title="手动添加友链"
				loading={createMut.isPending}
				onSubmit={(body: FriendLinkManualRequest) => {
					createMut.mutate(body, { onSuccess: () => setCreateOpen(false) });
				}}
			/>

			<FriendLinkFormDialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				title="编辑友链"
				initial={editing ?? undefined}
				loading={updateMut.isPending}
				onSubmit={(body: FriendLinkManualRequest) => {
					if (!editing) return;
					updateMut.mutate(
						{ id: editing.id, body },
						{ onSuccess: () => setEditing(null) },
					);
				}}
			/>

			<ConfirmDialog
				open={!!deleting}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title="删除友链"
				description={`确定要删除友链「${deleting?.name ?? ""}」吗？此操作不可恢复。`}
				confirmLabel="删除"
				loading={deleteMut.isPending}
				onConfirm={() => {
					if (!deleting) return;
					deleteMut.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
				}}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/friend-links")({
	component: AdminFriendLinksPage,
});
