// 认证状态 slice
// 管理 JWT token、refresh_token 和用户信息

import { create } from "zustand"

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
  /** JWT 访问令牌 */
  token: string | null
  /** JWT 刷新令牌 */
  refreshToken: string | null
  /** 令牌过期时间戳（毫秒） */
  expiresAt: number | null
  /** 当前用户信息 */
  user: User | null
  /** 设置认证信息（登录/刷新后调用） */
  setAuth: (token: string, refreshToken: string, expiresIn: number, user?: User) => void
  /** 更新用户信息 */
  setUser: (user: User) => void
  /** 清除认证状态（登出时调用） */
  clearAuth: () => void
}

/**
 * 从 localStorage 加载初始状态
 */
function loadInitialState(): {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
} {
  const token = localStorage.getItem("token")
  const refreshToken = localStorage.getItem("refresh_token")
  const expiresAtStr = localStorage.getItem("token_expires_at")
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null

  // 如果 token 已过期，清除所有
  if (token && expiresAt && expiresAt < Date.now()) {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("token_expires_at")
    return { token: null, refreshToken: null, expiresAt: null }
  }

  return { token, refreshToken, expiresAt }
}

const initial = loadInitialState()

/**
 * 认证状态 store
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  refreshToken: initial.refreshToken,
  expiresAt: initial.expiresAt,
  user: null,

  setAuth: (token, refreshToken, expiresIn, user) => {
    const expiresAt = Date.now() + expiresIn * 1000
    localStorage.setItem("token", token)
    localStorage.setItem("refresh_token", refreshToken)
    localStorage.setItem("token_expires_at", String(expiresAt))
    set({ token, refreshToken, expiresAt, user: user ?? null })
  },

  setUser: (user) => set({ user }),

  clearAuth: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("token_expires_at")
    set({ token: null, refreshToken: null, expiresAt: null, user: null })
  },
}))

/** 导出类型供其他模块使用 */
export type { User, AuthState }