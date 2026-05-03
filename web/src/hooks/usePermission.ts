import { useAuthStore } from "@/store";

// 检查当前用户是否拥有指定权限
export function usePermission(code: string): boolean {
  const { user } = useAuthStore();

  if (!user) return false;
  if (user.role === "superadmin") return true;

  return user.permissions?.includes(code) ?? false;
}

// 获取当前用户所有权限
export function usePermissions(): string[] {
  const { user } = useAuthStore();

  if (!user) return [];
  if (user.role === "superadmin") return ["*"];

  return user.permissions ?? [];
}
