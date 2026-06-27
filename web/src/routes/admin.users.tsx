import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable } from "@features/admin-shared/ui/data-table";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table";
import { exportToCsv } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Pencil, Plus, RefreshCw, Search, Trash2, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
    useAdminUsers,
    useBatchUpdateStatus,
    useBatchUpdateRole,
    useDeleteUser,
} from "@features/admin-users/api/queries";
import type { AdminUserDTO } from "@features/admin-users/model/types";
import { useDebouncedValue } from "@features/admin-shared/ui/data-table";
import { CreateUserDialog } from "@features/admin-users/ui/CreateUserDialog";
import { EditUserDialog } from "@features/admin-users/ui/EditUserDialog";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import { useAdminRoles } from "@features/admin-roles/api/queries";
import { getRoleDisplayName, getRoleBadgeVariant } from "@features/admin-roles/lib/utils";

export const Route = createFileRoute("/admin/users")({
    component: AdminUsers,
});

function AdminUsers() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<DataTableSort | null>(null);
    const [keyword, setKeyword] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

    // 对话框状态
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUserDTO | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    // 权限检查
    const canUpdateRole = useHasPermission("user:update-role");
    const canBan = useHasPermission("user:ban");
    const canUpdateUser = useHasPermission("user:list"); // 编辑用户权限

    // 查询角色列表
    const { data: roles = [] } = useAdminRoles();


    // 防抖搜索关键词
    const debouncedKeyword = useDebouncedValue(keyword, 300);

    // 查询用户列表
    const {
        data: response,
        isLoading,
        error,
        refetch,
    } = useAdminUsers({
        page,
        limit: pageSize,
        keyword: debouncedKeyword,
        role: roleFilter === "all" ? undefined : roleFilter,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
    });

    // Mutations
    const batchUpdateStatus = useBatchUpdateStatus();
    const batchUpdateRole = useBatchUpdateRole();
    const deleteUser = useDeleteUser();

    // 客户端排序（如果后端不支持排序）
    const sortedData = useMemo(() => {
        if (!response?.data || !sort) return response?.data || [];
        const copy = [...response.data];
        copy.sort((a, b) => {
            const av = a[sort.key as keyof AdminUserDTO];
            const bv = b[sort.key as keyof AdminUserDTO];
            const cmp = String(av).localeCompare(String(bv), "zh");
            return sort.order === "asc" ? cmp : -cmp;
        });
        return copy;
    }, [response?.data, sort]);

    const handleDelete = (user: AdminUserDTO) => {
        setDeletingUserId(user.id);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!deletingUserId) return;
        deleteUser.mutate(deletingUserId, {
            onSuccess: () => {
                setDeleteConfirmOpen(false);
                setDeletingUserId(null);
            },
        });
    };

    const handleBatchDisable = () => {
        if (selectedIds.size === 0) return;
        batchUpdateStatus.mutate(
            {
                ids: Array.from(selectedIds),
                is_active: false,
            },
            {
                onSuccess: () => {
                    setSelectedIds(new Set());
                },
            },
        );
    };

    const handleBatchEnable = () => {
        if (selectedIds.size === 0) return;
        batchUpdateStatus.mutate(
            {
                ids: Array.from(selectedIds),
                is_active: true,
            },
            {
                onSuccess: () => {
                    setSelectedIds(new Set());
                },
            },
        );
    };

    const handleBatchChangeRole = (role: "user" | "admin" | "superadmin") => {
        if (selectedIds.size === 0) return;
        batchUpdateRole.mutate(
            {
                ids: Array.from(selectedIds),
                role,
            },
            {
                onSuccess: () => {
                    setSelectedIds(new Set());
                },
            },
        );
    };

    const columns: DataTableColumn<AdminUserDTO>[] = [
        {
            key: "username",
            header: "用户名",
            accessorKey: "username",
            sortable: true,
            ellipsis: true,
        },
        {
            key: "email",
            header: "邮箱",
            accessorKey: "email",
            sortable: true,
            ellipsis: true,
            tooltip: (row) => `邮箱: ${row.email}`,
        },
        {
            key: "role",
            header: "角色",
            sortable: true,
            cell: (row) => {
                const variant = getRoleBadgeVariant(row.role);
                const label = getRoleDisplayName(roles, row.role, row.role);
                return <Badge variant={variant}>{label}</Badge>;
            },
        },
        {
            key: "is_active",
            header: "状态",
            cell: (row) => (
                <Badge variant={row.is_active ? "outline" : "destructive"}>
                    {row.is_active ? "正常" : "已禁用"}
                </Badge>
            ),
        },
        {
            key: "email_verified",
            header: "邮箱验证",
            cell: (row) => (
                <Badge variant={row.email_verified ? "outline" : "secondary"}>
                    {row.email_verified ? "已验证" : "未验证"}
                </Badge>
            ),
        },
        {
            key: "created_at",
            header: "创建时间",
            accessorKey: "created_at",
            sortable: true,
            cell: (row) => new Date(row.created_at).toLocaleString("zh-CN"),
        },
        {
            key: "actions",
            header: "操作",
            hideable: false,
            sticky: "right",
            width: "96px",
            align: "center",
            cell: (row) => (
                <div className="flex justify-center gap-1">
                    <PermissionGuard permission="user:list">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            title="编辑"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingUser(row);
                                setEditDialogOpen(true);
                            }}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="user:ban">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            title="删除"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(row);
                            }}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageShell
                title="用户管理"
                description="管理系统用户、角色和权限"
                action={
                    <PermissionGuard permission="user:list">
                        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="size-3.5" />
                            创建用户
                        </Button>
                    </PermissionGuard>
                }
            >
            <DataTable
                columns={columns}
                data={sortedData}
                keyExtractor={(row) => row.id}
                page={page}
                pageSize={pageSize}
                total={response?.pagination?.total || 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
                sort={sort}
                onSortChange={setSort}
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                bulkActions={
                    <>
                        <PermissionGuard permission="user:ban">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBatchEnable}
                                disabled={selectedIds.size === 0 || batchUpdateStatus.isPending}
                            >
                                启用
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="user:ban">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBatchDisable}
                                disabled={selectedIds.size === 0 || batchUpdateStatus.isPending}
                            >
                                <Trash2 className="size-3.5" />
                                批量禁用
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="user:update-role">
                            <Select
                                value="batch-role"
                                onValueChange={(role) =>
                                    handleBatchChangeRole(role as "user" | "admin" | "superadmin")
                                }
                                disabled={selectedIds.size === 0 || batchUpdateRole.isPending}
                            >
                                <SelectTrigger size="sm" className="h-9 w-[140px]">
                                    <UserCog className="size-3.5 mr-1" />
                                    批量修改角色
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.name} value={role.name}>
                                            设为{role.description || role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </PermissionGuard>
                    </>
                }
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-users-columns"
                filtered={debouncedKeyword.length > 0 || roleFilter !== "all" || statusFilter !== "all"}
                density={density}
                stickyHeader
                maxHeight="60vh"
                resizable
                expandable
                renderExpandedRow={(row) => (
                    <div className="text-muted-foreground space-y-1 text-sm">
                        <p>ID：{row.id}</p>
                        <p>用户名：{row.username}</p>
                        <p>邮箱：{row.email}</p>
                        <p>角色：{row.role}</p>
                        <p>状态：{row.is_active ? "正常" : "已禁用"}</p>
                        <p>邮箱验证：{row.email_verified ? "已验证" : "未验证"}</p>
                        <p>个人简介：{row.bio || "无"}</p>
                        <p>创建时间：{new Date(row.created_at).toLocaleString("zh-CN")}</p>
                    </div>
                )}
                onRowClick={(row) => {
                    // 检查编辑用户权限
                    if (canUpdateUser) {
                        setEditingUser(row);
                        setEditDialogOpen(true);
                    } else {
                        toast.error("您没有编辑用户的权限");
                    }
                }}
                caption="用户列表"
                emptyTitle="暂无用户"
                emptyDescription="还没有任何用户，点击上方按钮创建第一个用户"
                toolbar={
                    <>
                        <div className="relative min-w-50 max-w-[320px] flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="搜索用户名 / 邮箱..."
                                value={keyword}
                                onChange={(e) => {
                                    setKeyword(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger size="sm" className="h-9 w-30" aria-label="角色筛选">
                                <SelectValue placeholder="选择角色" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部角色</SelectItem>
                                {roles.map((role) => (
                                    <SelectItem key={role.name} value={role.name}>
                                        {role.description || role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger size="sm" className="h-9 w-30" aria-label="状态筛选">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="active">正常</SelectItem>
                                <SelectItem value="inactive">已禁用</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={density}
                            onValueChange={(v) => setDensity(v as "comfortable" | "compact")}
                        >
                            <SelectTrigger size="sm" className="h-9 w-30" aria-label="行密度">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="comfortable">标准密度</SelectItem>
                                <SelectItem value="compact">紧凑密度</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading}
                        >
                            <RefreshCw className="size-3.5" />
                            刷新
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                exportToCsv("用户列表", columns, sortedData);
                                toast.success("已导出当前页 CSV");
                            }}
                        >
                            <Download className="size-3.5" />
                            导出 CSV
                        </Button>
                    </>
                }
            />
        </PageShell>

        {/* 创建用户对话框 */}
        <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

        {/* 编辑用户对话框 */}
        {editingUser && (
            <EditUserDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                user={editingUser}
            />
        )}

        {/* 删除确认对话框 */}
        <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="确认删除用户"
            description="此操作不可撤销，确定要删除这个用户吗？"
            confirmLabel="删除"
            cancelLabel="取消"
            variant="destructive"
            onConfirm={handleConfirmDelete}
            loading={deleteUser.isPending}
        />
    </>
    );
}
