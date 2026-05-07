import { useMemo } from "react";
import { useAuthStore } from "@/store";

/**
 * 检查用户是否拥有指定权限
 * @param code 单个权限码或权限码数组
 * @param mode 检查模式：'any'（默认，拥有任意一个即可）或 'all'（必须拥有全部）
 */
export function usePermission(
  code: string | string[],
  mode: "any" | "all" = "any"
): boolean {
  const { user } = useAuthStore();
  const codes = Array.isArray(code) ? code : [code];

  return useMemo(() => {
    if (!user) return false;
    if (user.role === "superadmin") return true;

    const userPerms = user.permissions ?? [];
    if (mode === "all") {
      return codes.every((c) => userPerms.includes(c));
    }
    return codes.some((c) => userPerms.includes(c));
  }, [user, codes, mode]);
}

/**
 * 检查用户是否拥有所有指定权限（AND 模式）
 */
export function useAllPermissions(code: string | string[]): boolean {
  return usePermission(code, "all");
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
