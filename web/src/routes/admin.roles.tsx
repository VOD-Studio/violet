import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminRoles, useDeleteRole } from "@features/admin-roles/api/queries";
import type { RoleDTO } from "@features/admin-roles/model/types";
import { CreateRoleDialog } from "@features/admin-roles/ui/CreateRoleDialog";
import { EditRoleDialog } from "@features/admin-roles/ui/EditRoleDialog";
import { RolePermissionsDialog } from "@features/admin-roles/ui/RolePermissionsDialog";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table";
import { DataTable, usePagedQuery } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Settings, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/roles")({
	component: AdminRolesPage,
});

function AdminRolesPage() {
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<RoleDTO | null>(null);
	const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
	const [configuringRole, setConfiguringRole] = useState<RoleDTO | null>(null);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deletingRole, setDeletingRole] = useState<RoleDTO | null>(null);
	const [sort, setSort] = useState<DataTableSort | null>(null);

	// 查询角色列表（分页）
	const { data: paged, isLoading, error, refetch, pagination } = usePagedQuery(useAdminRoles);
	const roles = paged?.data ?? [];
	const deleteRole = useDeleteRole();

	const sortedRoles = useMemo(() => {
		if (!sort) return roles;
		const copy = [...roles];
		copy.sort((a, b) => {
			// permission_count 列无对应 DTO 字段，取 permission_codes 数组长度
			let av: unknown;
			let bv: unknown;
			if (sort.key === "permission_count") {
				av = a.permission_codes?.length ?? 0;
				bv = b.permission_codes?.length ?? 0;
			} else {
				av = a[sort.key as keyof RoleDTO];
				bv = b[sort.key as keyof RoleDTO];
			}
			// 数值列按数值比，避免字符串排序导致 "10" < "2"
			const cmp =
				typeof av === "number" && typeof bv === "number"
					? av - bv
					: String(av).localeCompare(String(bv), "zh");
			return sort.order === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [roles, sort]);

	const handleEdit = (role: RoleDTO) => {
		setEditingRole(role);
		setEditDialogOpen(true);
	};

	const handleConfigurePermissions = (role: RoleDTO) => {
		setConfiguringRole(role);
		setPermissionsDialogOpen(true);
	};

	const handleDelete = (role: RoleDTO) => {
		setDeletingRole(role);
		setDeleteConfirmOpen(true);
	};

	const handleConfirmDelete = () => {
		if (!deletingRole?.id) return;
		deleteRole.mutate(deletingRole.id, {
			onSuccess: () => {
				setDeleteConfirmOpen(false);
				setDeletingRole(null);
			},
		});
	};

	// 表格列定义
	const columns: DataTableColumn<RoleDTO>[] = [
		{
			key: "name",
			header: "角色名称",
			hideable: false,
			accessorKey: "name",
			sortable: true,
			ellipsis: true,
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "description",
			header: "描述",
			accessorKey: "description",
			ellipsis: true,
		},
		{
			key: "user_count",
			header: "用户数",
			sortable: true,
			cell: (row) => (
				<div className="flex items-center gap-1 text-muted-foreground">
					<Users className="size-3.5" />
					<span>{row.user_count || 0}</span>
				</div>
			),
		},
		{
			key: "permission_count",
			header: "权限数",
			sortable: true,
			cell: (row) => {
				const count = row.permission_codes?.length ?? 0;
				return (
					<Badge variant="secondary">
						{row.permission_codes?.includes("*") ? "全部" : `${count} 个权限`}
					</Badge>
				);
			},
		},
		{
			key: "created_at",
			header: "创建时间",
			sortable: true,
			cell: (row) =>
				row.created_at ? new Date(row.created_at).toLocaleDateString("zh-CN") : "-",
		},
		{
			key: "actions",
			header: "操作",
			sticky: "right",
			width: "120px",
			cell: (row) => {
				// 内置角色：可改描述、可改权限分配；不可重命名、不可删除
				// （重命名破坏 users.role 硬编码、删除会让依赖角色失权，后端仍守卫）
				const isBuiltin = row.is_builtin;
				return (
					<div className="flex items-center gap-2">
						<PermissionGuard permission="role:manage">
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											size="icon-sm"
											variant="ghost"
											onClick={() => handleConfigurePermissions(row)}
											aria-label={`配置权限 ${row.name}`}
										>
											<Settings className="size-3.5" />
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>配置权限</TooltipContent>
							</Tooltip>
						</PermissionGuard>
						<PermissionGuard permission="role:manage">
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											size="icon-sm"
											variant="ghost"
											onClick={() => handleEdit(row)}
											aria-label={`编辑角色 ${row.name}`}
										>
											<Pencil className="size-3.5" />
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>编辑角色</TooltipContent>
							</Tooltip>
						</PermissionGuard>
						<PermissionGuard permission="role:manage">
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											size="icon-sm"
											variant="ghost"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											onClick={() => handleDelete(row)}
											disabled={isBuiltin || deleteRole.isPending}
											aria-label={`删除角色 ${row.name}`}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{isBuiltin ? "内置角色不可删除" : "删除角色"}
								</TooltipContent>
							</Tooltip>
						</PermissionGuard>
					</div>
				);
			},
		},
	];

	return (
		<TooltipProvider>
			<PageShell
				title="角色管理"
				description="管理系统角色和权限配置"
				action={
					<PermissionGuard permission="role:manage">
						<Button size="sm" onClick={() => setCreateDialogOpen(true)}>
							<Plus className="size-3.5" />
							创建角色
						</Button>
					</PermissionGuard>
				}
			>
				<DataTable<RoleDTO>
					data={sortedRoles}
					columns={columns}
					pagination={pagination}
					keyExtractor={(row) => String(row.id)}
					selectable={false}
					loading={isLoading}
					error={error ? new Error(error.message) : null}
					onRetry={() => refetch()}
					sort={sort}
					onSortChange={setSort}
					storageKey="admin-roles-columns"
					caption="角色列表"
					emptyTitle="暂无角色"
					emptyDescription="还没有创建任何角色"
				/>

				{/* 创建角色对话框 */}
				<CreateRoleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

				{/* 编辑角色对话框 */}
				{editingRole && (
					<EditRoleDialog
						open={editDialogOpen}
						onOpenChange={setEditDialogOpen}
						role={editingRole}
					/>
				)}

				{/* 角色权限配置对话框 */}
				{configuringRole?.id && (
					<RolePermissionsDialog
						open={permissionsDialogOpen}
						onOpenChange={setPermissionsDialogOpen}
						roleId={configuringRole.id}
						roleName={configuringRole.name}
					/>
				)}

				{/* 删除确认对话框 */}
				<ConfirmDialog
					open={deleteConfirmOpen}
					onOpenChange={setDeleteConfirmOpen}
					onConfirm={handleConfirmDelete}
					title="确认删除角色"
					description={
						`确定要删除角色 ${deletingRole?.name} 吗？` +
						((deletingRole?.user_count || 0) > 0
							? `\n警告：该角色下有 ${deletingRole?.user_count} 个用户，删除后这些用户将失去此角色。`
							: "")
					}
					confirmLabel="删除"
					loading={deleteRole.isPending}
				/>
			</PageShell>
		</TooltipProvider>
	);
}
