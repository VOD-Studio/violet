import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminRoles, useDeleteRole } from "@features/admin-roles/api/queries";
import type { RoleDTO } from "@features/admin-roles/model/types";
import { CreateRoleDialog } from "@features/admin-roles/ui/CreateRoleDialog";
import { EditRoleDialog } from "@features/admin-roles/ui/EditRoleDialog";
import { RolePermissionsDialog } from "@features/admin-roles/ui/RolePermissionsDialog";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Settings, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";

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

    // 查询角色列表
    const { data: roles = [], isLoading, error, refetch } = useAdminRoles();
    const deleteRole = useDeleteRole();

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
            accessorKey: "name",
            sortable: true,
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
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
            cell: (row) => (
                <Badge variant="secondary">{row.permission_codes?.length || 0} 个权限</Badge>
            ),
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
            cell: (row) => {
                // 内置角色（user/admin/superadmin）不可删/不可改名/不可改权限
                const isBuiltin = row.is_builtin;
                return (
                    <div className="flex items-center gap-2">
                        <PermissionGuard permission="role:manage">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleConfigurePermissions(row)}
                                disabled={isBuiltin}
                                title={isBuiltin ? "内置角色不可修改权限" : "配置权限"}
                            >
                                <Settings className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="role:manage">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleEdit(row)}
                                disabled={isBuiltin}
                                title={isBuiltin ? "内置角色不可编辑" : "编辑角色"}
                            >
                                <Pencil className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="role:manage">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleDelete(row)}
                                disabled={isBuiltin || deleteRole.isPending}
                                title={isBuiltin ? "内置角色不可删除" : "删除角色"}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                    </div>
                );
            },
        },
    ];

    return (
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
                data={roles}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={1}
                pageSize={roles.length}
                total={roles.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-roles-columns"
                caption="角色列表"
                emptyTitle="暂无角色"
                emptyDescription="还没有创建任何角色，点击上方按钮创建第一个角色"
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
    );
}
