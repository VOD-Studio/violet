// 仪表盘统计 Query Keys 统一管理

export const dashboardKeys = {
  all: ["admin", "stats"] as const,
  stats: () => [...dashboardKeys.all] as const,
  views: () => ["admin", "views"] as const,
};
