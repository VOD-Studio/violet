// 媒体管理 Query Keys 统一管理

export const mediaKeys = {
  all: ["admin", "media"] as const,
  lists: () => [...mediaKeys.all, "list"] as const,
  list: (filters?: { page?: number; limit?: number; mimeType?: string }) =>
    [...mediaKeys.lists(), filters] as const,
  details: () => [...mediaKeys.all, "detail"] as const,
  detail: (id: string) => [...mediaKeys.details(), id] as const,
};
