// 全局状态管理 store
// 统一导出各个 slice
//
// 注：主题状态已迁移到 next-themes（见 src/hooks/useTheme.ts），不再使用 zustand。

export { type AuthState, type User, useAuthStore } from "./slices/auth";
export { usePostStore } from "./slices/post";
export { useSidebarStore } from "./slices/sidebar";
