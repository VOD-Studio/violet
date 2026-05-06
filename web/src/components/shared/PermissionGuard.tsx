import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

interface PermissionGuardProps {
  code?: string | string[]; // 支持单个或多个权限码，可选（不传则直接显示）
  children: ReactNode;
  fallback?: ReactNode; // 无权限时显示的内容
}

/**
 * 权限守卫组件
 * 如果未传入 code，直接显示 children
 * 如果传入 code，用户拥有任意一个权限则显示 children，否则显示 fallback
 */
export function PermissionGuard({
  code,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const hasPermission = usePermission(code ?? "");
  // 未传入权限码，直接显示
  if (!code) {
    return <>{children}</>;
  }
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
