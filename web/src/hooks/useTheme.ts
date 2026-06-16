// 主题管理 Hook
// 适配 next-themes，保持与原 zustand store 相同的调用接口
// （theme / resolvedTheme / setTheme / toggleTheme），组件无需改动
//
// 2.0 起：主题系统统一到 next-themes，移除了 zustand theme store。

import { useTheme as useNextTheme } from "next-themes";
import { useCallback } from "react";

/**
 * 主题管理 Hook
 * 封装 next-themes，返回与原 useTheme 相同的接口，并补充 toggleTheme
 */
export function useTheme() {
  const { theme, resolvedTheme, setTheme, systemTheme } = useNextTheme();

  /** 在 light / dark 之间切换（不切换 system） */
  const toggleTheme = useCallback(() => {
    const current = (resolvedTheme ?? "light") as "light" | "dark";
    setTheme(current === "light" ? "dark" : "light");
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    systemTheme,
    setTheme,
    toggleTheme,
  };
}
