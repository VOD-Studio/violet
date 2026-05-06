/**
 * 权限管理页面
 * 选择角色后为其分配权限
 */

import { useState, useEffect } from "react";
import {
  useRoles,
  usePermissions,
  useRolePermissions,
  useUpdateRolePermissions,
} from "@/features/admin/roles";
import type { Permission } from "@/features/admin/roles/types";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { useToast } from "@/components/shared/Toast";
import { Shield, Save, Loader2 } from "lucide-react";

/**
 * 按模块分组权限
 */
function groupPermissionsByModule(permissions: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const perm of permissions) {
    const module = perm.code.split(":")[0];
    if (!groups[module]) {
      groups[module] = [];
    }
    groups[module].push(perm);
  }
  return groups;
}

/**
 * 模块名称映射
 */
const moduleNames: Record<string, string> = {
  post: "文章管理",
  comment: "评论管理",
  tag: "标签管理",
  media: "媒体管理",
  emoji: "表情管理",
  playlist: "歌单管理",
  song: "歌曲管理",
  user: "用户管理",
  role: "角色管理",
  project: "项目管理",
  settings: "系统设置",
  announcement: "公告管理",
};

/**
 * 权限管理页面内容
 */
function PermissionsContent() {
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // 获取角色列表
  const { data: roles, isLoading: loadingRoles, error: rolesError } = useRoles();
  // 获取所有权限
  const { data: allPermissions, isLoading: loadingPermissions, error: permissionsError } =
    usePermissions();
  // 获取选中角色的权限
  const { data: rolePermissions, isLoading: loadingRolePermissions } =
    useRolePermissions(selectedRoleId ?? 0);
  // 更新角色权限
  const updatePermissions = useUpdateRolePermissions();

  const isLoading = loadingRoles || loadingPermissions;
  const error = rolesError || permissionsError;

  // 当角色权限加载完成时，更新选中状态
  useEffect(() => {
    if (rolePermissions) {
      setSelectedPermissions(new Set(rolePermissions.map((p) => p.code)));
    }
  }, [rolePermissions]);

  // 选择角色
  function handleSelectRole(role: { id: number; name: string; description?: string | null }) {
    setSelectedRoleId(role.id);
    setSelectedPermissions(new Set());
  }

  // 切换权限选中状态
  function handleTogglePermission(code: string, checked: boolean) {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(code);
      } else {
        newSet.delete(code);
      }
      return newSet;
    });
  }

  // 保存权限
  function handleSave() {
    if (!selectedRoleId) return;

    updatePermissions.mutate(
      {
        id: selectedRoleId,
        data: { permissions: Array.from(selectedPermissions) },
      },
      {
        onSuccess: () => {
          toast("权限更新成功", "success");
        },
        onError: () => {
          toast("权限更新失败", "error");
        },
      }
    );
  }

  // 按模块分组权限
  const groupedPermissions = allPermissions ? groupPermissionsByModule(allPermissions) : {};

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">权限管理</h1>
        <p className="text-muted-foreground">为角色分配系统权限</p>
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={() => {}} />}

      {/* 主内容 */}
      {!isLoading && !error && roles && allPermissions && (
        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          {/* 左侧：角色列表 */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">角色列表</h2>
            <div className="rounded-lg border">
              {roles.map((role, index) => (
                <button
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    selectedRoleId === role.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  } ${index > 0 ? "border-t" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{role.name}</span>
                    {role.name === "admin" && (
                      <Badge variant="secondary" className="text-xs">
                        管理员
                      </Badge>
                    )}
                  </div>
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
                    权限分配
                    {loadingRolePermissions && (
                      <Loader2 className="ml-2 inline size-4 animate-spin" />
                    )}
                  </h2>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updatePermissions.isPending || loadingRolePermissions}
                  >
                    {updatePermissions.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    保存
                  </Button>
                </div>

                <div className="rounded-lg border divide-y">
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module} className="p-4">
                      <h3 className="mb-3 text-sm font-medium">
                        {moduleNames[module] || module}
                      </h3>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <div
                            key={perm.code}
                            className="flex items-center gap-3 rounded-md p-2 hover:bg-muted transition-colors"
                          >
                            <Checkbox
                              id={perm.code}
                              checked={selectedPermissions.has(perm.code)}
                              onCheckedChange={(checked) =>
                                handleTogglePermission(perm.code, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={perm.code}
                              className="flex-1 cursor-pointer text-sm"
                            >
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
                description="从左侧选择一个角色来管理其权限"
                icon={<Shield className="size-12" />}
              />
            )}
          </div>
        </div>
      )}
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