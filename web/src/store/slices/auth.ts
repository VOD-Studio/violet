// 认证状态 slice
// 管理 JWT token、refresh_token 和用户信息
// 使用 persist 中间件自动持久化到 localStorage

import { create } from "zustand"
import { persist } from "zustand/middleware"

/** 用户信息结构 */
interface User {
  /** 用户唯一标识 */
  id: string
  /** 用户名 */
  username: string
  /** 邶箱地址 */
  email: string
  /** 头像 URL */
  avatar_url?: string
  /** 个人简介 */
  bio?: string
  /** 用户角色 */
  role?: string
  /** 邮箱是否已验证 */
  email_verified?: boolean
  /** 是否启用 */
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
  /** 刷新令牌过期时间戳（毫秒） */
  refreshExpiresAt: number | null
  /** 当前用户信息 */
  user: User | null
  /** 设置认证信息（登录/刷新后调用） */
  setAuth: (token: string, refreshToken: string, expiresIn: number, refreshExpiresIn?: number, user?: User) => void
  /** 更新用户信息 */
  setUser: (user: User) => void
  /** 清除认证状态（登出时调用） */
  clearAuth: () => void
}

/**
 * 认证状态 store
 * 使用 persist 中间件自动同步 localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      user: null,

      setAuth: (token, refreshToken, expiresIn, refreshExpiresIn, user) => {
        const expiresAt = Date.now() + expiresIn * 1000
        // 如果后端返回了 refreshExpiresIn，使用它；否则默认 7 天
        const refreshExpiresAtValue = refreshExpiresIn
          ? Date.now() + refreshExpiresIn * 1000
          : Date.now() + 7 * 24 * 60 * 60 * 1000
        set({ token, refreshToken, expiresAt, refreshExpiresAt: refreshExpiresAtValue, user: user ?? null })
      },

      setUser: (user) => set({ user }),

      clearAuth: () => set({ token: null, refreshToken: null, expiresAt: null, refreshExpiresAt: null, user: null }),
    }),
    {
      name: "auth-storage",
      // 过期检查：从存储恢复后检查 token 是否过期
      // 注意：只清除 access token，保留 refresh token 用于刷新
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // 如果 refresh token 也过期了，才完全清除
        if (state.refreshExpiresAt && state.refreshExpiresAt < Date.now()) {
          state.clearAuth()
          return
        }

        // 如果只是 access token 过期，保留 refresh token 和 user
        // 前端 api.ts 会在请求时自动尝试刷新
        if (state.expiresAt && state.expiresAt < Date.now()) {
          state.token = null
          state.expiresAt = null
          // 保留 refreshToken、refreshExpiresAt、user
        }
      },
    },
  ),
)

/** 导出类型供其他模块使用 */
export type { User, AuthState }