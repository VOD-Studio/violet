/**
 * 权限管理页面
 * 显示所有权限列表及拥有该权限的角色
 */

import { useState, useEffect } from "react";
import { usePermissions, useRoles, useRolePermissions } from "@/features/admin/roles";
import type { Role } from "@/features/admin/roles/types";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

/**
 * 权限列表表格骨架屏
 */
function PermissionsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">权限码</TableHead>
            <TableHead className="w-32">名称</TableHead>
            <TableHead>模块</TableHead>
            <TableHead className="w-64">拥有该权限的角色</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 显示拥有某个权限的角色列表
 */
function RolesWithPermission({
  roles,
}: {
  roles: Role[] | undefined;
}) {
  if (!roles || roles.length === 0) {
    return <span className="text-muted-foreground text-sm">无</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role.id} variant="secondary" className="text-xs">
          {role.name}
        </Badge>
      ))}
    </div>
  );
}

/**
 * 权限管理页面内容
 */
function PermissionsContent() {
  const { data: permissions, isLoading: loadingPermissions, error: permissionsError, refetch } = usePermissions();
  const { data: roles, isLoading: loadingRoles, error: rolesError } = useRoles();

  const isLoading = loadingPermissions || loadingRoles;
  const error = permissionsError || rolesError;

  // 存储权限到角色的映射
  const [permissionToRolesMap, setPermissionToRolesMap] = useState<Map<string, Role[]>>(() => new Map());
  // 已加载的角色ID集合
  const [loadedRoleIds, setLoadedRoleIds] = useState<Set<number>>(new Set());

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">权限管理</h1>
        <p className="text-muted-foreground">查看系统所有权限及其分配情况</p>
      </div>

      {/* 加载态 */}
      {isLoading && <PermissionsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && (!permissions || permissions.length === 0) && (
        <EmptyState
          title="暂无权限数据"
          description="系统尚未配置任何权限"
          icon={<Shield className="size-12" />}
        />
      )}

      {/* 权限列表表格 */}
      {!isLoading && !error && permissions && permissions.length > 0 && (
        <>
          {/* 为每个角色加载权限 */}
          {roles?.map((role) => (
            <RolePermissionLoader
              key={role.id}
              role={role}
              loadedRoleIds={loadedRoleIds}
              setLoadedRoleIds={setLoadedRoleIds}
              setPermissionToRolesMap={setPermissionToRolesMap}
            />
          ))}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">权限码</TableHead>
                  <TableHead className="w-32">名称</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead className="w-64">拥有该权限的角色</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((perm) => (
                  <TableRow key={perm.code}>
                    <TableCell className="font-mono text-sm">
                      {perm.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {perm.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {perm.module || "-"}
                    </TableCell>
                    <TableCell>
                      <RolesWithPermission
                        roles={permissionToRolesMap.get(perm.code)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 加载单个角色的权限并更新映射
 */
function RolePermissionLoader({
  role,
  loadedRoleIds,
  setLoadedRoleIds,
  setPermissionToRolesMap,
}: {
  role: Role;
  loadedRoleIds: Set<number>;
  setLoadedRoleIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setPermissionToRolesMap: React.Dispatch<React.SetStateAction<Map<string, Role[]>>>;
}) {
  const { data: rolePermissions } = useRolePermissions(role.id);

  // 当权限数据加载完成时，更新映射
  useEffect(() => {
    if (rolePermissions && !loadedRoleIds.has(role.id)) {
      setLoadedRoleIds((prev) => new Set(prev).add(role.id));
      setPermissionToRolesMap((prev) => {
        const newMap = new Map(prev);
        for (const perm of rolePermissions) {
          const existingRoles = newMap.get(perm.code) || [];
          newMap.set(perm.code, [...existingRoles, role]);
        }
        return newMap;
      });
    }
  }, [rolePermissions, role, loadedRoleIds, setLoadedRoleIds, setPermissionToRolesMap]);

  return null;
}

/**
 * 权限管理页面
 * 包裹在 PermissionGuard 中，需要 role:manage 权限
 */
export default function Permissions() {
  return (
    <PermissionGuard code="role:manage">
      <PermissionsContent />
    </PermissionGuard>
  );
}