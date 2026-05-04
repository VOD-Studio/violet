// 站点设置 Query Keys 统一管理

export const settingsKeys = {
  all: ["admin", "settings"] as const,
  detail: () => [...settingsKeys.all, "detail"] as const,
  public: ["settings", "public"] as const,
};
