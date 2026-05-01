// 认证状态 slice
// 管理 JWT token、refresh_token 和用户信息
// 所有状态持久化到 localStorage

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

/** localStorage 键名 */
const STORAGE_KEYS = {
  token: "token",
  refreshToken: "refresh_token",
  expiresAt: "token_expires_at",
  user: "user_info",
}

/**
 * 从 localStorage 加载初始状态
 */
function loadInitialState(): {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  user: User | null
} {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.expiresAt)
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null

  // 尝试加载用户信息
  let user: User | null = null
  const userStr = localStorage.getItem(STORAGE_KEYS.user)
  if (userStr) {
    try {
      user = JSON.parse(userStr)
    } catch {
      localStorage.removeItem(STORAGE_KEYS.user)
    }
  }

  // 如果 token 已过期，清除所有认证数据
  if (token && expiresAt && expiresAt < Date.now()) {
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
    localStorage.removeItem(STORAGE_KEYS.expiresAt)
    localStorage.removeItem(STORAGE_KEYS.user)
    return { token: null, refreshToken: null, expiresAt: null, user: null }
  }

  return { token, refreshToken, expiresAt, user }
}

const initial = loadInitialState()

/**
 * 认证状态 store
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  refreshToken: initial.refreshToken,
  expiresAt: initial.expiresAt,
  user: initial.user,

  setAuth: (token, refreshToken, expiresIn, user) => {
    const expiresAt = Date.now() + expiresIn * 1000
    localStorage.setItem(STORAGE_KEYS.token, token)
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt))
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
    }
    set({ token, refreshToken, expiresAt, user: user ?? null })
  },

  setUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
    set({ user })
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
    localStorage.removeItem(STORAGE_KEYS.expiresAt)
    localStorage.removeItem(STORAGE_KEYS.user)
    set({ token: null, refreshToken: null, expiresAt: null, user: null })
  },
}))

/** 导出类型供其他模块使用 */
export type { User, AuthState }