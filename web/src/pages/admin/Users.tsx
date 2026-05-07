/**
 * 用户管理页面
 * 从 API 获取用户列表，支持搜索筛选、角色修改、启用/禁用、创建、编辑、删除和批量操作
 */

import { useState, useMemo, useEffect } from "react";
import {
  useAdminUsers,
  useUpdateUserRole,
  useToggleUserStatus,
  useBatchUpdateUserStatus,
  useBatchUpdateUserRole,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "@/features/admin/users";
import type {
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest,
} from "@/features/admin/users/types";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Users as UsersIcon,
  Search,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
            <TableHead>邮箱验证</TableHead>
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
                <Skeleton className="h-4 w-12" />
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
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** 角色名映射 */
const roleLabels: Record<string, string> = {
  superadmin: "超级管理员",
  admin: "管理员",
  user: "用户",
};

/** 默认创建用户表单 */
const defaultCreateForm: CreateUserRequest = {
  username: "",
  email: "",
  password: "",
  role: "user",
  is_active: true,
};

export default function Users() {
  // 筛选状态
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 搜索防抖
  const debouncedSearch = useDebounce(search, 300);

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

  // 批量修改角色确认弹窗状态
  const [batchRoleConfirmState, setBatchRoleConfirmState] = useState<{
    open: boolean;
    role: string;
  }>({ open: false, role: "" });

  // 创建用户弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>(defaultCreateForm);

  // 编辑用户弹窗
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<UpdateUserRequest & { id: string }>({
    id: "",
    username: "",
    email: "",
    role: "user",
    is_active: true,
    email_verified: false,
    bio: "",
  });

  // 删除确认弹窗
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  // 查询参数
  const queryParams = useMemo(() => {
    const params: {
      search?: string;
      role?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (roleFilter && roleFilter !== "all") params.role = roleFilter;
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    params.page = page;
    params.limit = limit;
    return params;
  }, [debouncedSearch, roleFilter, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useAdminUsers(queryParams);
  const users = response?.users ?? [];
  const total = response?.total ?? 0;

  const updateRole = useUpdateUserRole();
  const toggleStatus = useToggleUserStatus();
  const batchUpdateStatus = useBatchUpdateUserStatus();
  const batchUpdateRole = useBatchUpdateUserRole();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // 全选/取消全选
  const allSelected = users.length > 0 && selectedIds.size === users.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  };

  const toggleSelectOne = (userId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setSelectedIds(newSet);
  };

  // --- 角色修改 ---
  const handleRoleChange = (
    userId: string,
    userName: string,
    currentRole: string,
    newRole: string
  ) => {
    setRoleConfirmState({ open: true, userId, userName, currentRole, newRole });
  };

  const confirmRoleChange = () => {
    updateRole.mutate(
      { id: roleConfirmState.userId, role: roleConfirmState.newRole },
      {
        onSuccess: () => toast.success("角色修改成功"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "角色修改失败，请重试"),
      }
    );
    setRoleConfirmState({ open: false, userId: "", userName: "", currentRole: "", newRole: "" });
  };

  // --- 状态切换 ---
  const handleToggleStatus = (userId: string, userName: string, currentActive: boolean) => {
    setConfirmState({ open: true, userId, userName, newStatus: !currentActive });
  };

  const confirmToggleStatus = () => {
    toggleStatus.mutate(
      { id: confirmState.userId, is_active: confirmState.newStatus },
      {
        onSuccess: () => toast.success(confirmState.newStatus ? "用户已启用" : "用户已禁用"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "操作失败，请重试"),
      }
    );
    setConfirmState({ open: false, userId: "", userName: "", newStatus: false });
    setSelectedIds(new Set());
  };

  // --- 批量操作 ---
  const handleBatchAction = (is_active: boolean) => {
    setBatchConfirmState({ open: true, is_active });
  };

  const confirmBatchAction = () => {
    const count = selectedIds.size;
    const activating = batchConfirmState.is_active;
    batchUpdateStatus.mutate(
      { user_ids: Array.from(selectedIds), is_active: activating },
      {
        onSuccess: () => toast.success(activating ? `已启用 ${count} 个用户` : `已禁用 ${count} 个用户`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "批量操作失败，请重试"),
      }
    );
    setBatchConfirmState({ open: false, is_active: false });
    setSelectedIds(new Set());
  };

  const handleBatchRoleChange = (role: string) => {
    setBatchRoleConfirmState({ open: true, role });
  };

  const confirmBatchRoleChange = () => {
    const count = selectedIds.size;
    const role = batchRoleConfirmState.role;
    batchUpdateRole.mutate(
      { user_ids: Array.from(selectedIds), role },
      {
        onSuccess: () => toast.success(`已将 ${count} 个用户的角色修改为「${roleLabels[role] ?? role}」`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "批量修改角色失败，请重试"),
      }
    );
    setBatchRoleConfirmState({ open: false, role: "" });
    setSelectedIds(new Set());
  };

  // --- 创建用户 ---
  const openCreateDialog = () => {
    setCreateForm(defaultCreateForm);
    setCreateOpen(true);
  };

  const handleCreateUser = () => {
    if (!createForm.username || !createForm.email || !createForm.password) {
      toast.error("请填写用户名、邮箱和密码");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("密码长度至少 6 个字符");
      return;
    }
    createUser.mutate(createForm, {
      onSuccess: () => {
        toast.success("用户创建成功");
        setCreateOpen(false);
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "创建用户失败，请重试"),
    });
  };

  // --- 编辑用户 ---
  const openEditDialog = (user: AdminUser) => {
    setEditForm({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      email_verified: user.email_verified,
      bio: "",
    });
    setEditOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editForm.username || !editForm.email) {
      toast.error("用户名和邮箱不能为空");
      return;
    }
    const { id, ...data } = editForm;
    updateUser.mutate(
      { id, ...data },
      {
        onSuccess: () => {
          toast.success("用户信息更新成功");
          setEditOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "更新失败，请重试"),
      }
    );
  };

  // --- 删除用户 ---
  const handleDeleteUser = (userId: string, userName: string) => {
    setDeleteConfirmState({ open: true, userId, userName });
  };

  const confirmDeleteUser = () => {
    deleteUser.mutate(deleteConfirmState.userId, {
      onSuccess: () => toast.success("用户已删除"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "删除失败，请重试"),
    });
    setDeleteConfirmState({ open: false, userId: "", userName: "" });
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理注册用户和权限</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-200">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
          <span className="text-sm text-muted-foreground">已选择 {selectedIds.size} 个用户</span>
          <Button size="sm" variant="default" onClick={() => handleBatchAction(true)} disabled={batchUpdateStatus.isPending}>
            {batchUpdateStatus.isPending && batchConfirmState.is_active && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            批量启用
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBatchAction(false)} disabled={batchUpdateStatus.isPending}>
            {batchUpdateStatus.isPending && !batchConfirmState.is_active && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            批量禁用
          </Button>
          <Select value="" onValueChange={(value) => value && handleBatchRoleChange(value)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="修改角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="superadmin">超级管理员</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="user">用户</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            取消选择
          </Button>
        </div>
      )}

      {isLoading && <UsersTableSkeleton />}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

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
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>邮箱验证</TableHead>
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
                    <Checkbox checked={selectedIds.has(user.id)} onCheckedChange={() => toggleSelectOne(user.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.email_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
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
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="编辑">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={user.is_active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleToggleStatus(user.id, user.username, user.is_active)}
                      >
                        {user.is_active ? "禁用" : "启用"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id, user.username)} title="删除">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
          <div className="text-sm text-muted-foreground">共 {total} 个用户</div>
          <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} onPageChange={setPage} />
        </div>
      )}

      {/* ========== 弹窗 ========== */}

      {/* 创建用户弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                placeholder="请输入用户名"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                placeholder="请输入邮箱"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input
                type="password"
                placeholder="至少 6 个字符"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={createForm.role} onValueChange={(value) => setCreateForm({ ...createForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">超级管理员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={createForm.is_active}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, is_active: !!checked })}
              />
              <Label>启用用户</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">超级管理员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>简介</Label>
              <Textarea
                placeholder="用户简介（可选）"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editForm.is_active}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: !!checked })}
                />
                <Label>启用</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editForm.email_verified}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, email_verified: !!checked })}
                />
                <Label>邮箱已验证</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleUpdateUser} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认切换状态弹窗 */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState({ open: false, userId: "", userName: "", newStatus: false })}
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

      {/* 批量修改角色确认弹窗 */}
      <ConfirmDialog
        open={batchRoleConfirmState.open}
        onClose={() => setBatchRoleConfirmState({ open: false, role: "" })}
        onConfirm={confirmBatchRoleChange}
        title="批量修改角色"
        description={`确定要将选中的 ${selectedIds.size} 个用户的角色修改为「${roleLabels[batchRoleConfirmState.role] ?? batchRoleConfirmState.role}」吗？此操作可能会影响这些用户的权限。`}
        confirmLabel="确认修改"
        destructive={batchRoleConfirmState.role === "user"}
        isLoading={batchUpdateRole.isPending}
      />

      {/* 角色修改确认弹窗 */}
      <ConfirmDialog
        open={roleConfirmState.open}
        onClose={() => setRoleConfirmState({ open: false, userId: "", userName: "", currentRole: "", newRole: "" })}
        onConfirm={confirmRoleChange}
        title="修改用户角色"
        description={
          roleConfirmState.currentRole === "superadmin" || roleConfirmState.currentRole === "admin"
            ? `确定要将用户「${roleConfirmState.userName}」从「${roleLabels[roleConfirmState.currentRole] ?? roleConfirmState.currentRole}」降级为「${roleLabels[roleConfirmState.newRole] ?? roleConfirmState.newRole}」吗？此操作可能会影响该用户的权限。`
            : `确定要将用户「${roleConfirmState.userName}」的角色修改为「${roleLabels[roleConfirmState.newRole] ?? roleConfirmState.newRole}」吗？`
        }
        confirmLabel="确认修改"
        destructive={roleConfirmState.currentRole === "superadmin" || roleConfirmState.currentRole === "admin"}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirmState.open}
        onClose={() => setDeleteConfirmState({ open: false, userId: "", userName: "" })}
        onConfirm={confirmDeleteUser}
        title="删除用户"
        description={`确定要删除用户「${deleteConfirmState.userName}」吗？此操作不可撤销，该用户的所有数据将被永久删除。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteUser.isPending}
      />
    </div>
  );
}
