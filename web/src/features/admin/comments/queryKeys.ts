// 评论管理 Query Keys 统一管理

import type { CommentStatusFilter } from "./types";

export const commentKeys = {
  all: ["admin", "comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  list: (status: CommentStatusFilter) => [...commentKeys.lists(), status] as const,
  pending: () => [...commentKeys.all, "pending"] as const,
  stats: () => [...commentKeys.all, "stats"] as const,
  details: () => [...commentKeys.all, "detail"] as const,
  detail: (id: string) => [...commentKeys.details(), id] as const,
};
