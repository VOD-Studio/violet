import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminPermissions, useDeletePermission } from "@features/admin-permissions/api/queries";
import type { PermissionDTO } from "@features/admin-permissions/model/types";
import { CreatePermissionDialog } from "@features/admin-permissions/ui/CreatePermissionDialog";
import { ConfirmDialog } from "@shared/ui/confirm-dialog"
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { useIsSuperAdmin } from "@features/auth/hooks/usePermissions";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";

export const Route = createFileRoute("/admin/permissions")({
	component: AdminPermissionsPage,
});

interface FlatRow {
	row: PermissionDTO;
	/** 0=menu 行，1=action 行 */
	depth: number;
	/** 所属 menu 的 id（action 行用于判断是否随父折叠而隐藏） */
	menuId: string;
	/** action 行：父 menu 是否展开（menu 行恒为 true） */
	visible: boolean;
}

function AdminPermissionsPage() {
	const isSuperAdmin = useIsSuperAdmin();
	const { data: tree = [], isLoading, error, refetch } = useAdminPermissions();
	const deletePermission = useDeletePermission();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<PermissionDTO | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState<PermissionDTO | null>(null);

	// 已折叠的 menu id 集合（默认全部展开，集合为空）
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	const toggleMenu = (menuId: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(menuId)) {
				next.delete(menuId);
			} else {
				next.add(menuId);
			}
			return next;
		});
	};

	const handleEdit = (p: PermissionDTO) => {
		setEditing(p);
		setDialogOpen(true);
	};
	const handleCreate = () => {
		setEditing(null);
		setDialogOpen(true);
	};
	const handleDelete = (p: PermissionDTO) => {
		setDeleting(p);
		setDeleteOpen(true);
	};
	const confirmDelete = () => {
		if (!deleting?.id) return;
		deletePermission.mutate(deleting.id, {
			onSuccess: () => {
				setDeleteOpen(false);
				setDeleting(null);
			},
		});
	};

	// 把树压平成两层行：menu 行 + 其下 action 行（action 仅在父展开时显示）
	// TODO: 权限有 sort 字段用于菜单排序，但缺少拖拽排序批量更新接口；
	// 如需拖拽调整菜单/操作顺序，需后端支持并保持树形结构。
	const flatRows = useMemo<FlatRow[]>(() => {
		const rows: FlatRow[] = [];
		tree.forEach((menu) => {
			const menuId = String(menu.id);
			const isCollapsed = collapsed.has(menuId);
			rows.push({ row: menu, depth: 0, menuId, visible: true });
			if (!isCollapsed) {
				(menu.children || []).forEach((action) => {
					rows.push({ row: action, depth: 1, menuId, visible: true });
				});
			}
		});
		return rows;
	}, [tree, collapsed]);

	const columns: DataTableColumn<FlatRow>[] = [
		{
			key: "expand",
			header: "",
			width: "40px",
			hideable: false,
			cell: (r) => {
				// 仅 menu 行显示展开/折叠箭头
				if (r.row.type !== "menu") return null;
				const isCollapsed = collapsed.has(r.menuId);
				return (
					<button
						type="button"
						onClick={() => toggleMenu(r.menuId)}
						className="hover:bg-accent flex size-6 items-center justify-center rounded transition-colors"
						aria-expanded={!isCollapsed}
						aria-label={isCollapsed ? "展开" : "折叠"}
					>
						<ChevronRight
							className={cn(
								"size-4 transition-transform",
								!isCollapsed && "rotate-90",
							)}
						/>
					</button>
				);
			},
		},
		// TODO: 权限为树形结构，普通列排序会破坏层级展示。
		// 如需排序，应实现「同级节点内排序」或后端返回有序树，当前暂不支持。
		{
			key: "code",
			header: "代码",
			hideable: false,
			ellipsis: true,
			cell: (r) => (
				<div className="flex items-center gap-2" style={{ paddingLeft: r.depth * 20 }}>
					<code className="font-mono text-primary bg-primary/10 rounded px-2 py-0.5 text-sm">
						{r.row.code}
					</code>
				</div>
			),
		},
		{
			key: "name",
			header: "名称",
			ellipsis: true,
			cell: (r) => <span className="font-medium">{r.row.name}</span>,
		},
		{
			key: "type",
			header: "类型",
			cell: (r) => (
				<Badge variant={r.row.type === "menu" ? "default" : "outline"}>
					{r.row.type === "menu" ? "分组" : "操作"}
				</Badge>
			),
		},
		{
			key: "description",
			header: "描述",
			ellipsis: true,
			cell: (r) => r.row.description || "-",
		},
		{
			key: "builtin",
			header: "内置",
			cell: (r) =>
				r.row.is_builtin ? (
					<Badge variant="secondary">
						<Lock className="size-3" /> 内置
					</Badge>
				) : null,
		},
		{
			key: "actions_col",
			header: "操作",
			sticky: "right",
			width: "96px",
			cell: (r) => {
				const isBuiltin = !!r.row.is_builtin;
				return (
					<div className="flex items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								{/* span 包裹：让 Radix Tooltip 能附着到可能 disabled 的按钮上 */}
								<span>
									<Button
										size="icon-sm"
										variant="ghost"
										onClick={() => handleEdit(r.row)}
										disabled={!isSuperAdmin}
									>
										<Pencil className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>编辑</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										size="icon-sm"
										variant="ghost"
										onClick={() => handleDelete(r.row)}
										disabled={isBuiltin || !isSuperAdmin}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								{isBuiltin ? "内置权限不可删除" : "删除"}
							</TooltipContent>
						</Tooltip>
					</div>
				);
			},
		},
	];

	return (
		<TooltipProvider>
			<PageShell
				title="权限管理"
				description="管理系统权限定义"
				action={
					isSuperAdmin ? (
						<Button size="sm" onClick={handleCreate}>
							<Plus className="size-3.5" />
							新建权限
						</Button>
					) : null
				}
			>
				<DataTable<FlatRow>
					data={flatRows}
					columns={columns}
					keyExtractor={(r) => `${r.menuId}-${r.row.id}`}
					page={1}
					pageSize={flatRows.length}
					total={flatRows.length}
					onPageChange={() => {}}
					selectable={false}
					loading={isLoading}
					error={error ? new Error(error.message) : null}
					onRetry={() => refetch()}
					storageKey="admin-permissions-columns"
					caption="权限列表"
					emptyTitle="暂无权限"
					emptyDescription="系统中还没有定义任何权限"
				/>

				<CreatePermissionDialog
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					editing={editing}
				/>

				<ConfirmDialog
					open={deleteOpen}
					onOpenChange={setDeleteOpen}
					onConfirm={confirmDelete}
					title="确认删除权限"
					description={`确定要删除权限 ${deleting?.name}（${deleting?.code}）吗？`}
					confirmLabel="删除"
					loading={deletePermission.isPending}
				/>
			</PageShell>
		</TooltipProvider>
	);
}
