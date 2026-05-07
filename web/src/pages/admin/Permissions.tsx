/**
 * 权限管理页面
 * 支持创建、编辑、删除权限，以及为角色分配权限
 */

import { useState, useEffect } from "react";
import {
  usePermissions,
  useRoles,
  useRolePermissions,
  useUpdateRolePermissions,
} from "@/features/admin/roles";
import {
  moduleNames,
  getModule,
  groupPermissionsByModule,
  getModuleDisplayName,
} from "@/features/admin/roles/utils";
import type { Permission } from "@/features/admin/roles/types";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { api, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil, Trash2, Save, Loader2, Users } from "lucide-react";

/**
 * 权限管理页面内容
 */
function PermissionsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 权限列表
  const { data: permissions, isLoading: loadingPermissions, error: permissionsError, refetch } =
    usePermissions();
  // 角色列表（用于权限分配）
  const { data: roles } = useRoles();

  // 当前模式：list 或 assign
  const [mode, setMode] = useState<"list" | "assign">("list");
  // 选中的角色（用于权限分配）
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<Set<string>>(new Set());

  // 创建权限弹窗
  const [createDialog, setCreateDialog] = useState<{ open: boolean }>({ open: false });
  const [createForm, setCreateForm] = useState({ code: "", name: "" });
  const [createLoading, setCreateLoading] = useState(false);

  // 编辑权限弹窗
  const [editDialog, setEditDialog] = useState<{ open: boolean; permission?: Permission }>({
    open: false,
  });
  const [editForm, setEditForm] = useState({ name: "" });
  const [editLoading, setEditLoading] = useState(false);

  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; permission?: Permission }>({
    open: false,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 获取选中角色的权限
  const { data: rolePermissions, isLoading: loadingRolePermissions } =
    useRolePermissions(selectedRoleId ?? 0);
  const updateRolePermissions = useUpdateRolePermissions();

  // 当角色权限加载完成时，更新选中状态
  useEffect(() => {
    if (rolePermissions) {
      setSelectedPermissionCodes(new Set(rolePermissions.map((p) => p.code)));
    }
  }, [rolePermissions]);

  // 创建权限
  async function handleCreate() {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      toast("权限码和名称不能为空", "error");
      return;
    }

    setCreateLoading(true);
    try {
      await api.post("/admin/permissions", {
        code: createForm.code.trim(),
        name: createForm.name.trim(),
      });
      toast("权限创建成功", "success");
      setCreateDialog({ open: false });
      setCreateForm({ code: "", name: "" });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "权限创建失败";
      toast(message, "error");
    }
    setCreateLoading(false);
  }

  // 编辑权限
  async function handleEdit() {
    if (!editDialog.permission || !editForm.name.trim()) {
      toast("权限名称不能为空", "error");
      return;
    }

    setEditLoading(true);
    try {
      await api.patch(`/admin/permissions/${editDialog.permission.code}`, {
        name: editForm.name.trim(),
      });
      toast("权限更新成功", "success");
      setEditDialog({ open: false });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "权限更新失败";
      toast(message, "error");
    }
    setEditLoading(false);
  }

  // 删除权限
  async function handleDelete() {
    if (!deleteConfirm.permission) return;

    setDeleteLoading(true);
    try {
      await api.del(`/admin/permissions/${deleteConfirm.permission.code}`);
      toast("权限删除成功", "success");
      setDeleteConfirm({ open: false });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "权限删除失败";
      toast(message, "error");
    }
    setDeleteLoading(false);
  }

  // 打开编辑弹窗
  function openEditDialog(permission: Permission) {
    setEditForm({ name: permission.name });
    setEditDialog({ open: true, permission });
  }

  // 切换权限选中状态（角色分配模式）
  function handleTogglePermission(code: string, checked: boolean) {
    setSelectedPermissionCodes((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(code);
      } else {
        newSet.delete(code);
      }
      return newSet;
    });
  }

  // 保存角色权限
  function handleSaveRolePermissions() {
    if (!selectedRoleId) return;

    updateRolePermissions.mutate(
      {
        id: selectedRoleId,
        data: { permissions: Array.from(selectedPermissionCodes) },
      },
      {
        onSuccess: () => {
          toast("角色权限更新成功", "success");
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : "角色权限更新失败";
          toast(message, "error");
        },
      }
    );
  }

  const isLoading = loadingPermissions;
  const error = permissionsError;

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">权限管理</h1>
          <p className="text-muted-foreground">管理系统权限和角色权限分配</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === "list" ? "default" : "outline"}
            onClick={() => setMode("list")}
          >
            <Shield className="mr-2 size-4" />
            权限列表
          </Button>
          <Button
            variant={mode === "assign" ? "default" : "outline"}
            onClick={() => setMode("assign")}
          >
            <Users className="mr-2 size-4" />
            角色分配
          </Button>
        </div>
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">权限码</TableHead>
                <TableHead className="w-32">名称</TableHead>
                <TableHead className="w-20">模块</TableHead>
                <TableHead className="text-right w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 权限列表模式 */}
      {!isLoading && !error && mode === "list" && permissions && (
        <>
          <Button onClick={() => setCreateDialog({ open: true })}>
            <Plus className="mr-2 size-4" />
            创建权限
          </Button>

          {permissions.length === 0 ? (
            <EmptyState
              title="暂无权限"
              description="点击上方按钮创建第一个权限"
              icon={<Shield className="size-12" />}
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">权限码</TableHead>
                    <TableHead className="w-32">名称</TableHead>
                    <TableHead className="w-20">模块</TableHead>
                    <TableHead className="text-right w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.code}>
                      <TableCell className="font-mono text-sm">
                        <Badge variant="outline">{perm.code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{perm.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {getModuleDisplayName(getModule(perm.code))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(perm)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ open: true, permission: perm })}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* 角色分配模式 */}
      {!isLoading && !error && mode === "assign" && permissions && roles && (
        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          {/* 左侧：角色列表 */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">选择角色</h2>
            <div className="rounded-lg border">
              {roles.map((role, index) => (
                <button
                  key={role.id}
                  onClick={() => {
                    setSelectedRoleId(role.id);
                    setSelectedPermissionCodes(new Set());
                  }}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    selectedRoleId === role.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  } ${index > 0 ? "border-t" : ""}`}
                >
                  <span>{role.name}</span>
                  {role.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧：权限分配 */}
          <div className="space-y-4">
            {selectedRoleId ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    分配权限
                    {loadingRolePermissions && (
                      <Loader2 className="ml-2 inline size-4 animate-spin" />
                    )}
                  </h2>
                  <Button
                    size="sm"
                    onClick={handleSaveRolePermissions}
                    disabled={updateRolePermissions.isPending || loadingRolePermissions}
                  >
                    {updateRolePermissions.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    保存
                  </Button>
                </div>

                <div className="rounded-lg border divide-y">
                  {Object.entries(groupPermissionsByModule(permissions)).map(([module, perms]) => (
                    <div key={module} className="p-4">
                      <h3 className="mb-3 text-sm font-medium">
                        {getModuleDisplayName(module)}
                      </h3>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <div
                            key={perm.code}
                            className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
                          >
                            <Checkbox
                              id={`assign-${perm.code}`}
                              checked={selectedPermissionCodes.has(perm.code)}
                              onCheckedChange={(checked) =>
                                handleTogglePermission(perm.code, checked as boolean)
                              }
                            />
                            <label htmlFor={`assign-${perm.code}`} className="flex-1 text-sm">
                              <span className="font-medium">{perm.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground font-mono">
                                {perm.code}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="请选择角色"
                description="从左侧选择一个角色来分配权限"
                icon={<Users className="size-12" />}
              />
            )}
          </div>
        </div>
      )}

      {/* 创建权限弹窗 */}
      <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">权限码</Label>
              <Input
                id="code"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="例如: post:create"
              />
              <p className="text-xs text-muted-foreground">
                格式：模块:操作，如 post:create、user:ban
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="例如: 创建文章"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog({ open: false })}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑权限弹窗 */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, permission: editDialog.permission })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>权限码</Label>
              <p className="text-sm font-mono text-muted-foreground">
                {editDialog.permission?.code}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false })}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false })}
        onConfirm={handleDelete}
        title="删除权限"
        description={`确定要删除权限「${deleteConfirm.permission?.name}」(${deleteConfirm.permission?.code})吗？此操作不可撤销，已分配给角色的该权限也会被移除。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteLoading}
      />
    </div>
  );
}

/**
 * 权限管理页面
 * 需要 role:manage 权限
 */
export default function Permissions() {
  return (
    <PermissionGuard code="role:manage">
      <PermissionsContent />
    </PermissionGuard>
  );
}