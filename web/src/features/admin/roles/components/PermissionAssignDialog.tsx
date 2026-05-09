// 权限分配弹窗

import { useState, useEffect, useMemo } from "react";
import { usePermissions, useRolePermissions, useUpdateRolePermissions } from "../api";
import { groupPermissionsByModule, getModuleDisplayName } from "../utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

/** PermissionAssignDialog 组件的属性 */
interface PermissionAssignDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 角色 ID */
  roleId: number;
  /** 角色名称 */
  roleName: string;
  /** 关闭回调 */
  onClose: () => void;
}

export function PermissionAssignDialog({
  open,
  roleId,
  roleName,
  onClose,
}: PermissionAssignDialogProps) {
  const { data: allPermissions } = usePermissions();
  const { data: rolePermissions, isLoading } = useRolePermissions(roleId);
  const updateRolePermissions = useUpdateRolePermissions();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const permissionGroups = useMemo(
    () => groupPermissionsByModule(allPermissions || []),
    [allPermissions]
  );

  useEffect(() => {
    if (rolePermissions) {
      setSelected(new Set(rolePermissions.map((p) => p.code)));
    }
  }, [rolePermissions]);

  const handleSubmit = () => {
    updateRolePermissions.mutate(
      { id: roleId, data: { permissions: Array.from(selected) } },
      { onSuccess: onClose }
    );
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>分配权限 - {roleName}</DialogTitle>
          <DialogDescription>勾选需要分配给该角色的权限</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                        checked={selected.has(perm.code)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(perm.code);
                          else next.delete(perm.code);
                          setSelected(next);
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={updateRolePermissions.isPending}>
            {updateRolePermissions.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
