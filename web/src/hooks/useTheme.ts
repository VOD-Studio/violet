/**
 * 主题管理 Hook
 * 支持三种模式：light、dark、system
 * 将主题偏好持久化到 localStorage，并同步到 document.documentElement 的 class
 */

import { useCallback, useEffect, useState } from "react"

/** 主题模式类型 */
type Theme = "light" | "dark" | "system"

/** localStorage 存储键名 */
const STORAGE_KEY = "theme"

/**
 * 获取系统当前的颜色方案偏好
 * 通过 matchMedia 检测 prefers-color-scheme: dark
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

/**
 * 根据主题模式解析实际应该应用的 light/dark
 * system 模式下返回系统偏好
 */
function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme
}

/**
 * 将主题应用到 document.documentElement
 * 添加/移除 dark class，供 Tailwind dark: 前缀生效
 */
function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
}

/**
 * 主题管理 Hook
 * 返回当前主题模式、解析后的实际主题、以及切换/设置函数
 */
export function useTheme() {
  /** 当前主题模式偏好，初始化时从 localStorage 读取 */
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved
    }
    return "system"
  })

  /** 解析后的实际主题（light 或 dark） */
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(theme),
  )

  /** 设置主题并持久化到 localStorage */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  /** 在 light 和 dark 之间快速切换，system 模式下切换为相反的固定模式 */
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const current = resolveTheme(prev)
      const next = current === "light" ? "dark" : "light"
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  /** 主题变化时应用到 DOM */
  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  /** 监听系统颜色方案变化，当用户选择 system 模式时自动切换 */
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (theme === "system") {
        const resolved = getSystemTheme()
        setResolvedTheme(resolved)
        applyTheme(resolved)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  return {
    /** 当前主题模式偏好 */
    theme,
    /** 解析后的实际主题（light 或 dark） */
    resolvedTheme,
    /** 设置主题模式 */
    setTheme,
    /** 在 light/dark 之间切换 */
    toggleTheme,
  }
}
