import type { PersonaSummary } from "@entities/persona/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	DataTable,
	type DataTableColumn,
	usePagedQuery,
} from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useCreatePersona, useDeletePersona } from "@features/persona-editor/api/mutations";
import { useAdminPersonas } from "@features/persona-editor/api/queries";
import { ApiError } from "@shared/api/error";
import { formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { SearchInput } from "@shared/ui/search-input";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** 多份人设档案的服务端分页管理列表。 */
export function PersonaListPage() {
	const navigate = useNavigate();
	const canManage = useHasPermission("persona:manage");
	const [search, setSearch] = useState("");
	const [deleting, setDeleting] = useState<PersonaSummary | null>(null);
	const createPersona = useCreatePersona();
	const deletePersona = useDeletePersona(deleting?.id ?? "");
	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(
		useAdminPersonas,
		{ q: search || undefined },
		{ initialPageSize: 20 },
	);

	const openPersona = (id: string) => {
		void navigate({ to: "/admin/personas/$id", params: { id } });
	};

	const handleCreate = async () => {
		try {
			const created = await createPersona.mutateAsync();
			await navigate({ to: "/admin/personas/$id", params: { id: created.id } });
		} catch (createError) {
			toast.error(createError instanceof Error ? createError.message : "创建人设档案失败");
		}
	};

	const handleDelete = async () => {
		if (!deleting) return;
		try {
			await deletePersona.mutateAsync({ expected_version: deleting.version });
			setDeleting(null);
			toast.success("人设档案已删除");
		} catch (deleteError) {
			setDeleting(null);
			if (deleteError instanceof ApiError && deleteError.status === 409) {
				toast.error("当前人设不能删除，请先激活另一份档案");
				return;
			}
			toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
		}
	};

	const columns: DataTableColumn<PersonaSummary>[] = [
		{
			key: "name",
			header: "名称",
			hideable: false,
			ellipsis: true,
			cell: (row) => (
				<button
					type="button"
					className="text-left font-medium hover:text-primary hover:underline"
					onClick={() => openPersona(row.id)}
				>
					{row.name || `（未命名档案）${row.id.slice(0, 8)}`}
				</button>
			),
		},
		{
			key: "completeness",
			header: "资料完整度",
			width: "150px",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Badge variant={row.is_complete ? "secondary" : "outline"}>
						{row.is_complete ? "完整" : "待补全"}
					</Badge>
					<span className="text-xs tabular-nums text-muted-foreground">
						{row.fact_count} 项
					</span>
				</div>
			),
		},
		{
			key: "image_count",
			header: "图片数",
			width: "90px",
			cell: (row) => <span className="text-sm tabular-nums">{row.image_count}</span>,
		},
		{
			key: "status",
			header: "当前状态",
			width: "110px",
			cell: (row) => (
				<Badge variant={row.is_active ? "default" : "outline"}>
					{row.is_active ? "当前人设" : "未激活"}
				</Badge>
			),
		},
		{
			key: "updated_at",
			header: "更新时间",
			width: "180px",
			cell: (row) => (
				<time dateTime={row.updated_at} className="text-xs text-muted-foreground">
					{formatDateTime(row.updated_at)}
				</time>
			),
		},
		{
			key: "actions",
			header: "操作",
			width: "96px",
			sticky: "right",
			cell: (row) => (
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => openPersona(row.id)}
								aria-label={`${canManage ? "编辑" : "查看"}人设 ${row.name || row.id.slice(0, 8)}`}
							>
								{canManage ? (
									<Pencil className="size-3.5" />
								) : (
									<Eye className="size-3.5" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{canManage ? "编辑" : "查看"}</TooltipContent>
					</Tooltip>
					{canManage ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										disabled={row.is_active}
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => setDeleting(row)}
										aria-label={`删除人设 ${row.name || row.id.slice(0, 8)}`}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								{row.is_active ? "当前人设不能删除" : "删除"}
							</TooltipContent>
						</Tooltip>
					) : null}
				</div>
			),
		},
	];

	return (
		<TooltipProvider>
			<PageShell
				title="人设档案"
				description="维护多份角色资料，并选择唯一公开的人设"
				action={
					canManage ? (
						<Button
							size="sm"
							disabled={createPersona.isPending}
							onClick={() => void handleCreate()}
						>
							{createPersona.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
							新建档案
						</Button>
					) : null
				}
				sticky={
					<div className="max-w-80 pt-1">
						<SearchInput
							defaultValue=""
							placeholder="按角色名称搜索…"
							onSearch={(value) => {
								setSearch(value.trim());
								setPage(1);
							}}
						/>
					</div>
				}
			>
				<DataTable<PersonaSummary>
					data={data?.data ?? []}
					columns={columns}
					keyExtractor={(row) => row.id}
					pagination={pagination}
					loading={isLoading}
					error={error}
					onRetry={() => void refetch()}
					storageKey="admin-personas"
					caption="人设档案列表"
					emptyTitle="没有匹配的人设档案"
					emptyDescription="调整搜索条件，或创建一份新的空档案。"
				/>

				<ConfirmDialog
					open={Boolean(deleting)}
					onOpenChange={(open) => {
						if (!open) setDeleting(null);
					}}
					onConfirm={() => void handleDelete()}
					title="确认删除人设档案"
					description={`确定要永久删除「${deleting?.name || deleting?.id.slice(0, 8) || "这份档案"}」吗？设定正文、资料项和图片引用都会一并清理。`}
					confirmLabel="永久删除"
					loading={deletePersona.isPending}
				/>
			</PageShell>
		</TooltipProvider>
	);
}
