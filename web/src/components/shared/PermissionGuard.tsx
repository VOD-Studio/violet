import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

interface PermissionGuardProps {
  code: string | string[]; // 支持单个或多个权限码
  children: ReactNode;
  fallback?: ReactNode; // 无权限时显示的内容
}

/**
 * 权限守卫组件
 * 如果用户拥有任意一个权限，则显示 children，否则显示 fallback
 */
export function PermissionGuard({
  code,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const hasPermission = usePermission(code);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}