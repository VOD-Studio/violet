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
  /** 邮箱地址 */
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
 * 认证状态 store
 * 使用 persist 中间件自动同步 localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      expiresAt: null,
      user: null,

      setAuth: (token, refreshToken, expiresIn, user) => {
        const expiresAt = Date.now() + expiresIn * 1000
        set({ token, refreshToken, expiresAt, user: user ?? null })
      },

      setUser: (user) => set({ user }),

      clearAuth: () => set({ token: null, refreshToken: null, expiresAt: null, user: null }),
    }),
    {
      name: "auth-storage",
      // 过期检查：从存储恢复后检查 token 是否过期
      onRehydrateStorage: () => (state) => {
        if (state?.expiresAt && state.expiresAt < Date.now()) {
          state.clearAuth()
        }
      },
    },
  ),
)

/** 导出类型供其他模块使用 */
export type { User, AuthState }