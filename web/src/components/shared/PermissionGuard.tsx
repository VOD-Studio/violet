import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

/** PermissionGuard 组件的属性 */
interface PermissionGuardProps {
  /** 支持单个或多个权限码，可选（不传则直接显示） */
  code?: string | string[];
  /** 检查模式：'any'（默认，拥有任意一个）或 'all'（必须全部） */
  mode?: "any" | "all";
  /** 子元素 */
  children: ReactNode;
  /** 无权限时显示的内容 */
  fallback?: ReactNode;
}

/**
 * 权限守卫组件
 * 如果未传入 code，直接显示 children
 * 如果传入 code，根据 mode 检查权限：
 *   - 'any'（默认）：用户拥有任意一个权限则显示 children
 *   - 'all'：用户必须拥有全部权限才显示 children
 */
export function PermissionGuard({
  code,
  mode = "any",
  children,
  fallback = null,
}: PermissionGuardProps) {
  const hasPermission = usePermission(code ?? "", mode);
  // 未传入权限码，直接显示
  if (!code) {
    return <>{children}</>;
  }
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
