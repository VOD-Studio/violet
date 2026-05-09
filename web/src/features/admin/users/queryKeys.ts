// 用户管理 Query Keys 统一管理

import type { UserListParams } from "./types";

export const userKeys = {
  all: ["admin", "users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params?: UserListParams) =>
    [...userKeys.lists(), params ?? {}] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
