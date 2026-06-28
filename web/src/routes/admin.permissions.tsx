import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable } from "@features/admin-shared/ui/data-table";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAdminPermissions } from "@features/admin-permissions/api/queries";
import type { PermissionDTO } from "@features/admin-permissions/model/types";

export const Route = createFileRoute("/admin/permissions")({
    component: AdminPermissionsPage,
});

function AdminPermissionsPage() {
    // 查询权限列表
    const { data: permissions = [], isLoading, error, refetch } = useAdminPermissions();

    // 按权限代码分组（如 user:*, admin:*, post:*）
    const groupedPermissions = useMemo(() => {
        const groups: Record<string, PermissionDTO[]> = {};
        permissions.forEach((permission) => {
            if (!permission.code) return;
            const prefix = permission.code.split(":")[0] || "other";
            if (!groups[prefix]) {
                groups[prefix] = [];
            }
            groups[prefix].push(permission);
        });
        return groups;
    }, [permissions]);

    // 表格列定义
    const columns: DataTableColumn<PermissionDTO>[] = [
        {
            key: "code",
            header: "权限代码",
            accessorKey: "code",
            sortable: true,
            cell: (row) => (
                <code className="text-primary bg-primary/10 rounded px-2 py-0.5 text-sm">
                    {row.code}
                </code>
            ),
        },
        {
            key: "name",
            header: "权限名称",
            accessorKey: "name",
            sortable: true,
        },
        {
            key: "description",
            header: "描述",
            accessorKey: "description",
            ellipsis: true,
        },
        {
            key: "group",
            header: "分组",
            sortable: true,
            cell: (row) => {
                const group = row.code?.split(":")[0] || "其他";
                return <Badge variant="outline">{group}</Badge>;
            },
        },
    ];

    return (
        <PageShell title="权限管理" description="查看系统所有权限定义">
            <div className="space-y-6">
                {/* 权限分组展示 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(groupedPermissions).map(([group, perms]) => (
                        <div key={group} className="bg-card rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm uppercase">{group}</h3>
                                <Badge variant="secondary">{perms.length}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {perms.map((p) => p.name).join("、")}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 权限详细列表 */}
                <DataTable<PermissionDTO>
                    data={permissions}
                    columns={columns}
                    keyExtractor={(row) => String(row.id)}
                    page={1}
                    pageSize={permissions.length}
                    total={permissions.length}
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
            </div>
        </PageShell>
    );
}
