// 权限表格组件 — 含创建/编辑/删除弹窗

import { usePermissions, useCreatePermission, useUpdatePermission, useDeletePermission } from "../api";
import { usePermissionForm } from "../hooks/usePermissionForm";
import type { Permission } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { ApiError } from "@/lib/api";
import { getModuleDisplayName } from "../utils";
import { Shield, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

const PermissionsTableSkeleton = () => (
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
);

export function PermissionsTable() {
  const { toast } = useToast();
  const { data: permissions, isLoading, error, refetch } = usePermissions();
  const createPermission = useCreatePermission();
  const updatePermission = useUpdatePermission();
  const deletePermission = useDeletePermission();

  const {
    createDialog, createForm, setCreateForm, openCreate, closeCreate,
    editDialog, editForm, setEditForm, openEdit, closeEdit,
    deleteConfirm, openDelete, closeDelete,
  } = usePermissionForm();

  const handleCreate = () => {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      toast("权限码和名称不能为空", "error");
      return;
    }
    createPermission.mutate(
      { code: createForm.code.trim(), name: createForm.name.trim() },
      {
        onSuccess: () => {
          toast("权限创建成功", "success");
          closeCreate();
        },
        onError: (err) => {
          toast(err instanceof ApiError ? err.message : "权限创建失败", "error");
        },
      }
    );
  };

  const handleEdit = () => {
    if (!editDialog.permission || !editForm.name.trim()) {
      toast("权限名称不能为空", "error");
      return;
    }
    updatePermission.mutate(
      { code: editDialog.permission.code, data: { name: editForm.name.trim() } },
      {
        onSuccess: () => {
          toast("权限更新成功", "success");
          closeEdit();
        },
        onError: (err) => {
          toast(err instanceof ApiError ? err.message : "权限更新失败", "error");
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteConfirm.permission) return;
    deletePermission.mutate(deleteConfirm.permission.code, {
      onSuccess: () => {
        toast("权限删除成功", "success");
        closeDelete();
      },
      onError: (err) => {
        toast(err instanceof ApiError ? err.message : "权限删除失败", "error");
      },
    });
  };

  const getModule = (code: string) => getModuleDisplayName(code.split(":")[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">权限管理</h1>
          <p className="text-muted-foreground">管理系统权限码</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          创建权限
        </Button>
      </div>

      {isLoading && <PermissionsTableSkeleton />}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {!isLoading && !error && permissions && permissions.length === 0 && (
        <EmptyState
          title="暂无权限"
          description="点击上方按钮创建第一个权限"
          icon={<Shield className="size-12" />}
        />
      )}

      {!isLoading && !error && permissions && permissions.length > 0 && (
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
              {permissions.map((perm: Permission) => (
                <TableRow key={perm.code}>
                  <TableCell className="font-mono text-sm">
                    <Badge variant="outline">{perm.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{perm.name}</TableCell>
                  <TableCell className="text-muted-foreground">{getModule(perm.code)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(perm)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDelete(perm)}>
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

      {/* 创建权限弹窗 */}
      <Dialog open={createDialog} onOpenChange={(v) => { if (!v) closeCreate(); }}>
        <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="perm-code">权限码</Label>
              <Input
                id="perm-code"
                value={createForm.code}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="例如: post:create"
              />
              <p className="text-xs text-muted-foreground">
                格式：模块:操作，如 post:create、user:ban
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-name">名称</Label>
              <Input
                id="perm-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="例如: 创建文章"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreate}>取消</Button>
            <Button onClick={handleCreate} disabled={createPermission.isPending}>
              {createPermission.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑权限弹窗 */}
      <Dialog open={editDialog.open} onOpenChange={(v) => { if (!v) closeEdit(); }}>
        <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>权限码</Label>
              <p className="text-sm font-mono text-muted-foreground">{editDialog.permission?.code}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-perm-name">名称</Label>
              <Input
                id="edit-perm-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>取消</Button>
            <Button onClick={handleEdit} disabled={updatePermission.isPending}>
              {updatePermission.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除权限确认 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title="删除权限"
        description={`确定要删除权限「${deleteConfirm.permission?.name}」(${deleteConfirm.permission?.code})吗？此操作不可撤销，已分配给角色的该权限也会被移除。`}
        confirmLabel="删除"
        destructive
        isLoading={deletePermission.isPending}
      />
    </div>
  );
}
