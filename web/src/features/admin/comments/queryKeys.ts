// 评论管理 Query Keys 统一管理

export const commentKeys = {
  all: ["admin", "comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  pending: () => [...commentKeys.all, "pending"] as const,
  details: () => [...commentKeys.all, "detail"] as const,
  detail: (id: string) => [...commentKeys.details(), id] as const,
};
