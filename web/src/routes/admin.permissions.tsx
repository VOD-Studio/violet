import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminPermissions, useDeletePermission } from "@features/admin-permissions/api/queries";
import type { PermissionDTO } from "@features/admin-permissions/model/types";
import { CreatePermissionDialog } from "@features/admin-permissions/ui/CreatePermissionDialog";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { useIsSuperAdmin } from "@features/auth/hooks/usePermissions";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/permissions")({
    component: AdminPermissionsPage,
});

interface FlatRow {
    row: PermissionDTO;
    depth: number;
    menuId: string;
}

function AdminPermissionsPage() {
    const isSuperAdmin = useIsSuperAdmin();
    const { data: tree = [], isLoading, error, refetch } = useAdminPermissions();
    const deletePermission = useDeletePermission();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<PermissionDTO | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<PermissionDTO | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // 默认展开所有 menu
    const allMenuKeys = useMemo(
        () => new Set(tree.filter((p) => p.type === "menu").map((p) => String(p.id))),
        [tree],
    );
    const expandedKeys = expanded.size ? expanded : allMenuKeys;

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

    // 把树压平成可展开的两层行：menu 行 + 其下 action 行（action 仅在展开时显示）
    const flatRows = useMemo<FlatRow[]>(() => {
        const rows: FlatRow[] = [];
        tree.forEach((menu) => {
            rows.push({ row: menu, depth: 0, menuId: String(menu.id) });
            const isOpen = expandedKeys.has(String(menu.id));
            if (isOpen) {
                (menu.children || []).forEach((action) => {
                    rows.push({ row: action, depth: 1, menuId: String(menu.id) });
                });
            }
        });
        return rows;
    }, [tree, expandedKeys]);

    const columns: DataTableColumn<FlatRow>[] = [
        {
            key: "code",
            header: "代码",
            sortable: true,
            cell: (r) => (
                <div className="flex items-center gap-2" style={{ paddingLeft: r.depth * 24 }}>
                    <code className="text-primary bg-primary/10 rounded px-2 py-0.5 text-sm">
                        {r.row.code}
                    </code>
                </div>
            ),
        },
        {
            key: "name",
            header: "名称",
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
            cell: (r) => {
                const isBuiltin = !!r.row.is_builtin;
                return (
                    <div className="flex items-center gap-2">
                        <PermissionGuard permission="admin:access">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleEdit(r.row)}
                                title="编辑"
                            >
                                <Pencil className="size-3.5" />
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="admin:access">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleDelete(r.row)}
                                disabled={isBuiltin}
                                title={isBuiltin ? "内置权限不可删除" : "删除"}
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
            title="权限管理"
            description="管理系统权限定义（menu 分组 + action 操作）"
            action={
                isSuperAdmin ? (
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="size-3.5" />
                        新建权限
                    </Button>
                ) : null
            }
        >
            {/* 展开/折叠控件 */}
            <div className="flex items-center gap-2 text-sm">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set(allMenuKeys))}>
                    全部展开
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
                    全部折叠
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        const ids = tree.filter((p) => p.type === "menu").map((p) => String(p.id));
                        setExpanded((prev) => {
                            const next = new Set(prev);
                            ids.forEach((id) => {
                                if (next.has(id)) {
                                    next.delete(id);
                                } else {
                                    next.add(id);
                                }
                            });
                            return next;
                        });
                    }}
                >
                    切换
                </Button>
            </div>

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
    );
}
