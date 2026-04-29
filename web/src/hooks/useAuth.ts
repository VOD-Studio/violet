// 认证状态管理 Hook
// 管理用户的登录状态、令牌存储和认证相关操作

import { useState, useCallback, useEffect } from "react"
import { api } from "@/lib/api"
import type { LoginFormData, RegisterFormData } from "@/lib/validations"

/** 用户信息结构 */
interface User {
  /** 用户 ID */
  id: string
  /** 用户名 */
  username: string
  /** 邮箱地址 */
  email: string
  /** 头像地址 */
  avatar?: string
}

/** 认证响应结构 */
interface AuthResponse {
  /** JWT 令牌 */
  token: string
  /** 用户信息 */
  user: User
}

/**
 * 认证状态管理 Hook
 * 提供登录、注册、登出功能，并从 localStorage 持久化令牌
 */
export function useAuth() {
  /** 当前用户信息 */
  const [user, setUser] = useState<User | null>(null)
  /** JWT 令牌 */
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  )
  /** 是否正在加载 */
  const [isLoading, setIsLoading] = useState(false)

  /* 组件挂载时，如果有令牌则尝试获取用户信息 */
  useEffect(() => {
    if (token) {
      fetchCurrentUser()
    }
  }, [token])

  /**
   * 获取当前登录用户的信息
   * 如果令牌无效则清除本地存储
   */
  const fetchCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true)
      const userData = await api.get<User>("/auth/me")
      setUser(userData)
    } catch {
      /* 令牌无效或过期，清除状态 */
      localStorage.removeItem("token")
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 用户登录
   * @param data - 登录表单数据（邮箱和密码）
   */
  const login = useCallback(async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      const response = await api.post<AuthResponse>("/auth/login", data)
      localStorage.setItem("token", response.token)
      setToken(response.token)
      setUser(response.user)
      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 用户注册
   * @param data - 注册表单数据（用户名、邮箱、密码）
   */
  const register = useCallback(async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      const { confirmPassword: _, ...registerData } = data
      const response = await api.post<AuthResponse>("/auth/register", registerData)
      localStorage.setItem("token", response.token)
      setToken(response.token)
      setUser(response.user)
      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 用户登出
   * 清除令牌和用户状态
   */
  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }, [])

  /** 是否已登录 */
  const isAuthenticated = !!token && !!user

  return {
    /** 当前用户信息 */
    user,
    /** JWT 令牌 */
    token,
    /** 是否正在加载 */
    isLoading,
    /** 是否已登录 */
    isAuthenticated,
    /** 登录函数 */
    login,
    /** 注册函数 */
    register,
    /** 登出函数 */
    logout,
    /** 重新获取用户信息 */
    refetchUser: fetchCurrentUser,
  }
}
