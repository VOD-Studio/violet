import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

interface Props {
  code: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

// 权限控制组件，根据用户权限决定是否渲染子元素
export function RequirePermission({ code, children, fallback = null }: Props) {
  const codes = Array.isArray(code) ? code : [code];
  const hasPermission = codes.some((c) => usePermission(c));

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
