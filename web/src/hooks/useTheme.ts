// 主题管理 Hook
// 基于 zustand store 的薄封装，保持组件调用方式不变

import { useThemeStore } from "@/store";

/**
 * 主题管理 Hook
 * 封装 zustand store，返回与原 useTheme 相同的接口
 */
export function useTheme() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useThemeStore();
  return { theme, resolvedTheme, setTheme, toggleTheme };
}
