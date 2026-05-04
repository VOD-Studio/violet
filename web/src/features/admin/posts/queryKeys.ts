// 文章管理 Query Keys 统一管理

import type { PostListParams } from "./types";

export const postKeys = {
  all: ["admin", "posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  list: (params: PostListParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, "detail"] as const,
  detail: (id: string) => [...postKeys.details(), id] as const,
};
