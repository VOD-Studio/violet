// 主题状态 slice
// 管理 light/dark/system 主题偏好
// 使用 persist 中间件自动持久化到 localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 主题模式类型 */
type Theme = "light" | "dark" | "system";

/**
 * 获取系统当前的颜色方案偏好
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * 根据主题模式解析实际应该应用的 light/dark
 */
function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

/**
 * 将主题应用到 document.documentElement
 */
function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

/** 主题状态接口 */
interface ThemeState {
  /** 当前主题模式偏好 */
  theme: Theme;
  /** 解析后的实际主题 */
  resolvedTheme: "light" | "dark";
  /** 设置主题模式 */
  setTheme: (theme: Theme) => void;
  /** 在 light/dark 之间切换 */
  toggleTheme: () => void;
}

/**
 * 主题状态 store
 * 使用 persist 中间件自动同步 localStorage
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",

      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },

      toggleTheme: () => {
        const current = get().theme;
        const currentResolved = resolveTheme(current);
        const next: Theme = currentResolved === "light" ? "dark" : "light";
        applyTheme(next);
        set({ theme: next, resolvedTheme: next });
      },
    }),
    {
      name: "theme-storage",
      // 从存储恢复后应用主题到 DOM
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          applyTheme(resolved);
          state.resolvedTheme = resolved;
        }
      },
    },
  ),
);

// 监听系统颜色方案变化（在 store 外部设置，避免重复监听）
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.theme === "system") {
      const newResolved = getSystemTheme();
      applyTheme(newResolved);
      useThemeStore.setState({ resolvedTheme: newResolved });
    }
  });
}
