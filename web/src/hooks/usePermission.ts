import { useMemo } from "react";
import { useAuthStore } from "@/store";

// 检查当前用户是否拥有指定权限（单个权限码）
export function usePermission(code: string): boolean;

// 检查当前用户是否拥有任意一个权限（多个权限码，任一满足即返回 true）
export function usePermission(codes: string[]): boolean;

export function usePermission(code: string | string[]): boolean {
  const { user } = useAuthStore();
  const codes = Array.isArray(code) ? code : [code];

  if (!user) return false;
  if (user.role === "superadmin") return true;

  return codes.some((c) => user.permissions?.includes(c) ?? false);
}

// 批量权限检查，返回每个权限码对应的检查结果
export function usePermissionMap(codes: string[]): Record<string, boolean> {
  const { user } = useAuthStore();

  return useMemo(() => {
    if (!user) {
      return Object.fromEntries(codes.map((c) => [c, false]));
    }

    if (user.role === "superadmin") {
      return Object.fromEntries(codes.map((c) => [c, true]));
    }

    return Object.fromEntries(
      codes.map((c) => [c, user.permissions?.includes(c) ?? false])
    );
  }, [user, codes]);
}

// 获取当前用户所有权限
export function usePermissions(): string[] {
  const { user } = useAuthStore();

  if (!user) return [];
  if (user.role === "superadmin") return ["*"];

  return user.permissions ?? [];
}
