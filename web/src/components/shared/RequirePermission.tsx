import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

/** RequirePermission 组件的属性（已废弃，请使用 PermissionGuard） */
interface Props {
  /** 权限码，支持单个或多个 */
  code: string | string[];
  /** 子元素 */
  children: ReactNode;
  /** 无权限时显示的内容 */
  fallback?: ReactNode;
}

/**
 * 权限控制组件，根据用户权限决定是否渲染子元素
 * 如果用户拥有任意一个权限，则显示 children，否则显示 fallback
 * @deprecated 请使用 PermissionGuard 组件
 */
export function RequirePermission({ code, children, fallback = null }: Props) {
  const hasPermission = usePermission(code);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
