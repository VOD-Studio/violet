// 全局状态管理 store
// 使用 zustand 管理认证状态、主题偏好和侧边栏状态

import { create } from "zustand"

/* ========== 认证状态 ========== */

/** 用户信息结构 */
interface User {
  id: string
  username: string
  email: string
  avatar_url?: string
  bio?: string
  role?: string
  email_verified?: boolean
  is_active?: boolean
}

/** 认证状态接口 */
interface AuthState {
  /** JWT 令牌 */
  token: string | null
  /** 当前用户信息 */
  user: User | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 设置令牌和用户信息 */
  setAuth: (token: string, user: User) => void
  /** 清除认证状态 */
  clearAuth: () => void
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 更新用户信息 */
  setUser: (user: User) => void
}

/**
 * 认证状态 store
 * 令牌自动持久化到 localStorage
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  isLoading: false,

  setAuth: (token, user) => {
    localStorage.setItem("token", token)
    set({ token, user })
  },

  clearAuth: () => {
    localStorage.removeItem("token")
    set({ token: null, user: null })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setUser: (user) => set({ user }),
}))

/* ========== 主题状态 ========== */

/** 主题模式类型 */
type Theme = "light" | "dark" | "system"

/**
 * 获取系统当前的颜色方案偏好
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
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
 * 主题偏好持久化到 localStorage，同步到 document.documentElement
 */
export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme()
  const resolved = resolveTheme(initial)

  /* 初始时应用主题到 DOM */
  if (typeof window !== "undefined") {
    applyTheme(resolved)
  }

  /* 监听系统颜色方案变化 */
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

/* ========== 侧边栏状态 ========== */

/** 侧边栏状态接口 */
interface SidebarState {
  /** 侧边栏是否折叠 */
  collapsed: boolean
  /** 切换折叠状态 */
  toggle: () => void
  /** 设置折叠状态 */
  setCollapsed: (collapsed: boolean) => void
}

/**
 * 侧边栏状态 store
 * 折叠偏好持久化到 localStorage
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: localStorage.getItem("sidebar-collapsed") === "true",

  toggle: () =>
    set((state) => {
      const next = !state.collapsed
      localStorage.setItem("sidebar-collapsed", String(next))
      return { collapsed: next }
    }),

  setCollapsed: (collapsed) => {
    localStorage.setItem("sidebar-collapsed", String(collapsed))
    set({ collapsed })
  },
}))
