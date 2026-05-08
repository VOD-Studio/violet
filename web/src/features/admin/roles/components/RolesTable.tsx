// 角色表格组件 — 含创建/编辑/删除弹窗和权限分配

import { useState } from "react";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from "../api";
import { useRoleForm } from "../hooks/useRoleForm";
import type { Role } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { PermissionAssignDialog } from "./PermissionAssignDialog";
import { Shield, Pencil, Trash2, Key, Plus, Loader2 } from "lucide-react";

const RolesTableSkeleton = () => (
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
            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export function RolesTable() {
  const { toast } = useToast();
  const { data: roles, isLoading, error, refetch } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const {
    dialog, form, setForm, deleteConfirm,
    openCreate, openEdit, closeDialog, openDelete, closeDelete,
  } = useRoleForm();

  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    roleId: number;
    roleName: string;
  }>({ open: false, roleId: 0, roleName: "" });

  const handleSubmitRole = () => {
    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) return;
    if (name.length > 50) {
      toast("角色名称长度不能超过 50 字符", "error");
      return;
    }
    if (description.length > 200) {
      toast("角色描述长度不能超过 200 字符", "error");
      return;
    }

    if (dialog.mode === "create") {
      createRole.mutate(
        { name, description: description || undefined },
        { onSuccess: () => closeDialog() }
      );
    } else if (dialog.role) {
      updateRole.mutate(
        { id: dialog.role.id, data: { name, description: description || undefined } },
        { onSuccess: () => closeDialog() }
      );
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.role) {
      deleteRole.mutate(deleteConfirm.role.id, {
        onSuccess: () => closeDelete(),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">角色与权限</h1>
          <p className="text-muted-foreground">管理系统角色和权限分配</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          创建角色
        </Button>
      </div>

      {isLoading && <RolesTableSkeleton />}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {!isLoading && !error && (!roles || roles.length === 0) && (
        <EmptyState
          title="暂无角色数据"
          description="点击上方按钮创建第一个角色"
          icon={<Shield className="size-12" />}
          actionLabel="创建角色"
          onAction={openCreate}
        />
      )}

      {!isLoading && !error && roles && roles.length > 0 && (
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
              {roles.map((role: Role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono text-muted-foreground">{role.id}</TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{role.user_count ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(role.created_at).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setAssignDialog({ open: true, roleId: role.id, roleName: role.name })}
                        title="分配权限"
                      >
                        <Key className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(role)} title="编辑">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openDelete(role)} title="删除">
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

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialog.open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "create" ? "创建角色" : "编辑角色"}</DialogTitle>
            <DialogDescription>
              {dialog.mode === "create" ? "输入角色名称和描述来创建新角色" : "修改角色信息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">角色名称</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="请输入角色名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">描述（可选）</Label>
              <Input
                id="role-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入角色描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>取消</Button>
            <Button
              onClick={handleSubmitRole}
              disabled={!form.name.trim() || createRole.isPending || updateRole.isPending}
            >
              {(createRole.isPending || updateRole.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {dialog.mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="删除角色"
        description={`确定要删除角色「${deleteConfirm.role?.name}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        isLoading={deleteRole.isPending}
      />

      {/* 权限分配 */}
      <PermissionAssignDialog
        open={assignDialog.open}
        roleId={assignDialog.roleId}
        roleName={assignDialog.roleName}
        onClose={() => setAssignDialog({ open: false, roleId: 0, roleName: "" })}
      />
    </div>
  );
}
