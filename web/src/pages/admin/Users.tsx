/**
 * 用户管理页面
 * 从 API 获取用户列表，支持搜索筛选、角色修改、启用/禁用和批量操作
 */

import { useState, useMemo, useEffect } from "react";
import {
  useAdminUsers,
  useUpdateUserRole,
  useToggleUserStatus,
  useBatchUpdateUserStatus,
} from "@/features/admin/users";
import type { AdminUser } from "@/features/admin/users/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pagination } from "@/components/shared/Pagination";
import { Users as UsersIcon, Search, Loader2 } from "lucide-react";

/**
 * 用户列表表格骨架屏
 */
function UsersTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Skeleton className="h-4 w-4" />
            </TableHead>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>注册时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 用户管理页面
 * 从 API 获取用户数据，提供搜索筛选、角色修改、状态切换和批量操作功能
 */
export default function Users() {
  // 筛选状态
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 分页状态
  const [page, setPage] = useState(1);
  const limit = 10;

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 确认弹窗状态
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    newStatus: boolean;
  }>({ open: false, userId: "", userName: "", newStatus: false });

  // 角色修改确认弹窗状态
  const [roleConfirmState, setRoleConfirmState] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    currentRole: string;
    newRole: string;
  }>({ open: false, userId: "", userName: "", currentRole: "", newRole: "" });

  // 批量操作确认弹窗状态
  const [batchConfirmState, setBatchConfirmState] = useState<{
    open: boolean;
    is_active: boolean;
  }>({ open: false, is_active: false });

  // 查询参数
  const queryParams = useMemo(() => {
    const params: { search?: string; role?: string; status?: string; page?: number; limit?: number } = {};
    if (search) params.search = search;
    if (roleFilter && roleFilter !== "all") params.role = roleFilter;
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    params.page = page;
    params.limit = limit;
    return params;
  }, [search, roleFilter, statusFilter, page]);

  // 筛选条件变化时重置页码
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const { data: response, isLoading, error, refetch } = useAdminUsers(queryParams);
  const users = response?.users ?? [];
  const total = response?.total ?? 0;

  const updateRole = useUpdateUserRole();
  const toggleStatus = useToggleUserStatus();
  const batchUpdateStatus = useBatchUpdateUserStatus();

  // 全选/取消全选
  const allSelected = users.length > 0 && selectedIds.size === users.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  }

  function toggleSelectOne(userId: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedIds(newSet);
  }

  /**
   * 弹出角色修改确认弹窗
   */
  function handleRoleChange(
    userId: string,
    userName: string,
    currentRole: string,
    newRole: string
  ) {
    setRoleConfirmState({
      open: true,
      userId,
      userName,
      currentRole,
      newRole,
    });
  }

  /**
   * 确认修改角色
   */
  function confirmRoleChange() {
    updateRole.mutate({ id: roleConfirmState.userId, role: roleConfirmState.newRole });
    setRoleConfirmState({
      open: false,
      userId: "",
      userName: "",
      currentRole: "",
      newRole: "",
    });
  }

  /**
   * 修改用户角色（直接修改，无确认）
   */
  function changeRole(userId: string, newRole: string) {
    updateRole.mutate({ id: userId, role: newRole });
  }

  /**
   * 弹出单个用户确认弹窗
   */
  function handleToggleStatus(
    userId: string,
    userName: string,
    currentActive: boolean
  ) {
    setConfirmState({
      open: true,
      userId,
      userName,
      newStatus: !currentActive,
    });
  }

  /**
   * 确认切换单个用户状态
   */
  function confirmToggleStatus() {
    toggleStatus.mutate({
      id: confirmState.userId,
      is_active: confirmState.newStatus,
    });
    setConfirmState({
      open: false,
      userId: "",
      userName: "",
      newStatus: false,
    });
    setSelectedIds(new Set());
  }

  /**
   * 弹出批量操作确认弹窗
   */
  function handleBatchAction(is_active: boolean) {
    setBatchConfirmState({ open: true, is_active });
  }

  /**
   * 确认批量操作
   */
  function confirmBatchAction() {
    batchUpdateStatus.mutate({
      user_ids: Array.from(selectedIds),
      is_active: batchConfirmState.is_active,
    });
    setBatchConfirmState({ open: false, is_active: false });
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理注册用户和权限</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-wrap gap-4">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-200">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 角色筛选 */}
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? "all")}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部角色</SelectItem>
            <SelectItem value="superadmin">超级管理员</SelectItem>
            <SelectItem value="admin">管理员</SelectItem>
            <SelectItem value="user">用户</SelectItem>
          </SelectContent>
        </Select>

        {/* 状态筛选 */}
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">启用</SelectItem>
            <SelectItem value="inactive">禁用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            已选择 {selectedIds.size} 个用户
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={() => handleBatchAction(true)}
            disabled={batchUpdateStatus.isPending}
          >
            {batchUpdateStatus.isPending && batchConfirmState.is_active && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            批量启用
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleBatchAction(false)}
            disabled={batchUpdateStatus.isPending}
          >
            {batchUpdateStatus.isPending && !batchConfirmState.is_active && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            批量禁用
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds(new Set())}
          >
            取消选择
          </Button>
        </div>
      )}

      {/* 加载态 */}
      {isLoading && <UsersTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && users.length === 0 && (
        <EmptyState
          title="暂无用户数据"
          description={
            search || roleFilter || statusFilter
              ? "没有找到符合条件的用户，请调整筛选条件"
              : "当前没有注册用户，或用户管理 API 尚未开放"
          }
          icon={<UsersIcon className="size-12" />}
        />
      )}

      {/* 用户列表表格 */}
      {!isLoading && !error && users.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: AdminUser) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={() => toggleSelectOne(user.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        value && value !== user.role && handleRoleChange(user.id, user.username, user.role, value)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superadmin">超级管理员</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="user">用户</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={user.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() =>
                        handleToggleStatus(
                          user.id,
                          user.username,
                          user.is_active
                        )
                      }
                    >
                      {user.is_active ? "禁用" : "启用"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 统计信息和分页 */}
      {!isLoading && !error && users.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 个用户
          </div>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / limit)}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 确认切换状态弹窗 */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() =>
          setConfirmState({
            open: false,
            userId: "",
            userName: "",
            newStatus: false,
          })
        }
        onConfirm={confirmToggleStatus}
        title={confirmState.newStatus ? "启用用户" : "禁用用户"}
        description={
          confirmState.newStatus
            ? `确定要启用用户「${confirmState.userName}」吗？`
            : `确定要禁用用户「${confirmState.userName}」吗？禁用后该用户将无法登录。`
        }
        confirmLabel={confirmState.newStatus ? "启用" : "禁用"}
        destructive={!confirmState.newStatus}
      />

      {/* 批量操作确认弹窗 */}
      <ConfirmDialog
        open={batchConfirmState.open}
        onClose={() => setBatchConfirmState({ open: false, is_active: false })}
        onConfirm={confirmBatchAction}
        title={batchConfirmState.is_active ? "批量启用用户" : "批量禁用用户"}
        description={
          batchConfirmState.is_active
            ? `确定要启用选中的 ${selectedIds.size} 个用户吗？`
            : `确定要禁用选中的 ${selectedIds.size} 个用户吗？禁用后这些用户将无法登录。`
        }
        confirmLabel={batchConfirmState.is_active ? "启用" : "禁用"}
        destructive={!batchConfirmState.is_active}
      />

      {/* 角色修改确认弹窗 */}
      <ConfirmDialog
        open={roleConfirmState.open}
        onClose={() =>
          setRoleConfirmState({
            open: false,
            userId: "",
            userName: "",
            currentRole: "",
            newRole: "",
          })
        }
        onConfirm={confirmRoleChange}
        title="修改用户角色"
        description={
          roleConfirmState.currentRole === "superadmin" || roleConfirmState.currentRole === "admin"
            ? `确定要将用户「${roleConfirmState.userName}」从「${roleConfirmState.currentRole === "superadmin" ? "超级管理员" : roleConfirmState.currentRole === "admin" ? "管理员" : "用户"}」降级为「${roleConfirmState.newRole === "superadmin" ? "超级管理员" : roleConfirmState.newRole === "admin" ? "管理员" : "用户"}」吗？此操作可能会影响该用户的权限。`
            : `确定要将用户「${roleConfirmState.userName}」的角色修改为「${roleConfirmState.newRole === "superadmin" ? "超级管理员" : roleConfirmState.newRole === "admin" ? "管理员" : "用户"}」吗？`
        }
        confirmLabel="确认修改"
        destructive={roleConfirmState.currentRole === "superadmin" || roleConfirmState.currentRole === "admin"}
      />
    </div>
  );
}