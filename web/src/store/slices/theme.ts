// 主题状态 slice
// 管理 light/dark/system 主题偏好

import { create } from "zustand"

/** 主题模式类型 */
type Theme = "light" | "dark" | "system"

/**
 * 获取系统当前的颜色方案偏好
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * 根据主题模式解析实际应该应用的 light/dark
 */
function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme
}

/**
 * 将主题应用到 document.documentElement
 */
function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
}

/** 主题状态接口 */
interface ThemeState {
  /** 当前主题模式偏好 */
  theme: Theme
  /** 解析后的实际主题 */
  resolvedTheme: "light" | "dark"
  /** 设置主题模式 */
  setTheme: (theme: Theme) => void
  /** 在 light/dark 之间切换 */
  toggleTheme: () => void
}

/**
 * 从 localStorage 读取保存的主题偏好
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const saved = localStorage.getItem("theme")
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved
  }
  return "system"
}

/**
 * 主题状态 store
 */
export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme()
  const resolved = resolveTheme(initial)

  // 初始时应用主题到 DOM
  if (typeof window !== "undefined") {
    applyTheme(resolved)
  }

  // 监听系统颜色方案变化
  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", () => {
      if (get().theme === "system") {
        const newResolved = getSystemTheme()
        applyTheme(newResolved)
        set({ resolvedTheme: newResolved })
      }
    })
  }

  return {
    theme: initial,
    resolvedTheme: resolved,

    setTheme: (theme) => {
      const resolved = resolveTheme(theme)
      localStorage.setItem("theme", theme)
      applyTheme(resolved)
      set({ theme, resolvedTheme: resolved })
    },

    toggleTheme: () => {
      const current = get().theme
      const currentResolved = resolveTheme(current)
      const next: Theme = currentResolved === "light" ? "dark" : "light"
      localStorage.setItem("theme", next)
      applyTheme(next)
      set({ theme: next, resolvedTheme: next })
    },
  }
})