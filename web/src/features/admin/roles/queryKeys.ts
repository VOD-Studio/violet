// 角色管理 Query Keys 统一管理

export const roleKeys = {
  all: ["admin", "roles"] as const,
  list: () => [...roleKeys.all, "list"] as const,
  detail: (id: number) => [...roleKeys.all, "detail", id] as const,
  permissions: (id: number) => [...roleKeys.all, "permissions", id] as const,
  allPermissions: () => [...roleKeys.all, "allPermissions"] as const,
};