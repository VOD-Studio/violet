/**
 * 角色管理页面
 * 从 API 获取角色列表，支持创建、编辑、删除角色和分配权限
 */

import { useState, useMemo, useEffect } from "react";
import {
  useRoles,
  usePermissions,
  useRolePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUpdateRolePermissions,
} from "@/features/admin/roles";
import {
  groupPermissionsByModule,
  getModuleDisplayName,
} from "@/features/admin/roles/utils";
import type { Role } from "@/features/admin/roles/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Shield, Pencil, Trash2, Key, Plus, Loader2 } from "lucide-react";

/**
 * 角色列表表格骨架屏
 */
function RolesTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>角色名称</TableHead>
            <TableHead>描述</TableHead>
            <TableHead className="w-20">用户数</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 角色管理页面
 */
export default function Roles() {
  const { data: roles, isLoading, error, refetch } = useRoles();
  const { data: allPermissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const updateRolePermissions = useUpdateRolePermissions();

  /** 创建/编辑角色弹窗状态 */
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    role?: Role;
  }>({ open: false, mode: "create" });

  /** 角色表单数据 */
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    role?: Role;
  }>({ open: false });

  /** 权限分配弹窗状态 */
  const [permissionDialog, setPermissionDialog] = useState<{
    open: boolean;
    roleId: number;
    roleName: string;
  }>({ open: false, roleId: 0, roleName: "" });

  /** 当前选中的权限代码列表 */
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set()
  );

  /** 权限分组 */
  const permissionGroups = useMemo(() => {
    return groupPermissionsByModule(allPermissions || []);
  }, [allPermissions]);

  /**
   * 打开创建角色弹窗
   */
  function handleCreate() {
    setRoleForm({ name: "", description: "" });
    setRoleDialog({ open: true, mode: "create" });
  }

  /**
   * 打开编辑角色弹窗
   */
  function handleEdit(role: Role) {
    setRoleForm({
      name: role.name,
      description: role.description || "",
    });
    setRoleDialog({ open: true, mode: "edit", role });
  }

  /**
   * 提交角色表单
   */
  function handleSubmitRole() {
    const name = roleForm.name.trim();
    const description = roleForm.description.trim();

    // 校验
    if (!name) return;
    if (name.length > 50) {
      alert("角色名称长度不能超过 50 字符");
      return;
    }
    if (description.length > 200) {
      alert("角色描述长度不能超过 200 字符");
      return;
    }

    if (roleDialog.mode === "create") {
      createRole.mutate(
        { name, description: description || undefined },
        {
          onSuccess: () => {
            setRoleDialog({ open: false, mode: "create" });
          },
        }
      );
    } else if (roleDialog.role) {
      updateRole.mutate(
        {
          id: roleDialog.role.id,
          data: {
            name,
            description: description || undefined,
          },
        },
        {
          onSuccess: () => {
            setRoleDialog({ open: false, mode: "edit" });
          },
        }
      );
    }
  }

  /**
   * 打开删除确认弹窗
   */
  function handleDeleteClick(role: Role) {
    setDeleteConfirm({ open: true, role });
  }

  /**
   * 确认删除角色
   */
  function confirmDelete() {
    if (deleteConfirm.role) {
      deleteRole.mutate(deleteConfirm.role.id, {
        onSuccess: () => {
          setDeleteConfirm({ open: false });
        },
      });
    }
  }

  /**
   * 打开权限分配弹窗
   */
  function handleOpenPermissionDialog(roleId: number, roleName: string) {
    setPermissionDialog({ open: true, roleId, roleName });
  }

  /**
   * 权限弹窗打开时加载角色权限
   */
  function PermissionDialogContent() {
    const { data: rolePermissions, isLoading: loadingPermissions } =
      useRolePermissions(permissionDialog.roleId);

    // 当权限数据加载完成时，初始化选中状态
    useEffect(() => {
      if (rolePermissions) {
        setSelectedPermissions(new Set(rolePermissions.map((p) => p.code)));
      }
    }, [rolePermissions]);

    if (loadingPermissions) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="max-h-96 space-y-4 overflow-y-auto py-4">
        {Object.entries(permissionGroups).map(([module, perms]) => (
          <div key={module}>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              {getModuleDisplayName(module)}
            </h4>
            <div className="flex flex-wrap gap-3">
              {perms.map((perm) => (
                <label
                  key={perm.code}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.has(perm.code)}
                    onChange={(e) => {
                      const newSet = new Set(selectedPermissions);
                      if (e.target.checked) {
                        newSet.add(perm.code);
                      } else {
                        newSet.delete(perm.code);
                      }
                      setSelectedPermissions(newSet);
                    }}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(permissionGroups).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            暂无可分配的权限
          </p>
        )}
      </div>
    );
  }

  /**
   * 提交权限更新
   */
  function handleSubmitPermissions() {
    updateRolePermissions.mutate(
      {
        id: permissionDialog.roleId,
        data: { permissions: Array.from(selectedPermissions) },
      },
      {
        onSuccess: () => {
          setPermissionDialog({ open: false, roleId: 0, roleName: "" });
          setSelectedPermissions(new Set());
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">角色管理</h1>
          <p className="text-muted-foreground">管理系统角色和权限分配</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          创建角色
        </Button>
      </div>

      {/* 加载态 */}
      {isLoading && <RolesTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && (!roles || roles.length === 0) && (
        <EmptyState
          title="暂无角色数据"
          description="点击上方按钮创建第一个角色"
          icon={<Shield className="size-12" />}
          actionLabel="创建角色"
          onAction={handleCreate}
        />
      )}

      {/* 角色列表表格 */}
      {!isLoading && !error && roles && roles.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>角色名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role: Role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {role.id}
                  </TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.user_count ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(role.created_at).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPermissionDialog(role.id, role.name)}
                        title="分配权限"
                      >
                        <Key className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(role)}
                        title="编辑"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(role)}
                        title="删除"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 创建/编辑角色弹窗 */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) =>
          setRoleDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {roleDialog.mode === "create" ? "创建角色" : "编辑角色"}
            </DialogTitle>
            <DialogDescription>
              {roleDialog.mode === "create"
                ? "输入角色名称和描述来创建新角色"
                : "修改角色信息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">角色名称</Label>
              <Input
                id="name"
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="请输入角色名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Input
                id="description"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="请输入角色描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialog({ open: false, mode: "create" })}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitRole}
              disabled={!roleForm.name.trim() || createRole.isPending || updateRole.isPending}
            >
              {(createRole.isPending || updateRole.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {roleDialog.mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false })}
        onConfirm={confirmDelete}
        title="删除角色"
        description={`确定要删除角色「${deleteConfirm.role?.name}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteRole.isPending}
      />

      {/* 权限分配弹窗 */}
      <Dialog
        open={permissionDialog.open}
        onOpenChange={(open) => {
          setPermissionDialog((prev) => ({ ...prev, open }));
          if (!open) {
            setSelectedPermissions(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分配权限 - {permissionDialog.roleName}</DialogTitle>
            <DialogDescription>
              勾选需要分配给该角色的权限
            </DialogDescription>
          </DialogHeader>
          <PermissionDialogContent />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPermissionDialog({ open: false, roleId: 0, roleName: "" });
                setSelectedPermissions(new Set());
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitPermissions}
              disabled={updateRolePermissions.isPending}
            >
              {updateRolePermissions.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}