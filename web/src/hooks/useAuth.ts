// 认证状态管理 Hook
// 基于 zustand store 管理认证状态，使用 react-query 的 useMutation 处理登录/注册

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store"
import type { LoginFormData, RegisterFormData } from "@/lib/validations"

/** 认证响应结构 */
interface AuthResponse {
  /** JWT 令牌 */
  token: string
  /** 用户信息 */
  user: {
    id: string
    username: string
    email: string
    avatar?: string
  }
}

/**
 * 认证状态管理 Hook
 * 使用 zustand store 管理状态，react-query 管理异步请求
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const { token, user, isLoading, setAuth, clearAuth, setLoading, setUser } = useAuthStore()

  /** 查询当前用户信息，仅在有 token 时启用 */
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<AuthResponse["user"]>("/auth/me"),
    enabled: !!token && !user,
    retry: false,
  })

  /* 查询成功时更新 store 中的用户信息 */
  if (userQuery.data && !user) {
    setUser(userQuery.data)
  }

  /* 查询失败时清除认证状态 */
  if (userQuery.isError && token) {
    clearAuth()
    queryClient.removeQueries({ queryKey: ["auth"] })
  }

  /** 登录 mutation */
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) =>
      api.post<AuthResponse>("/auth/login", data),
    onSuccess: (response) => {
      setAuth(response.token, response.user)
      queryClient.invalidateQueries({ queryKey: ["auth"] })
    },
  })

  /** 注册 mutation */
  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => {
      const { confirmPassword: _, ...registerData } = data
      return api.post<AuthResponse>("/auth/register", registerData)
    },
    onSuccess: (response) => {
      setAuth(response.token, response.user)
      queryClient.invalidateQueries({ queryKey: ["auth"] })
    },
  })

  /** 登出函数 */
  const logout = () => {
    clearAuth()
    queryClient.removeQueries({ queryKey: ["auth"] })
    queryClient.clear()
  }

  return {
    /** 当前用户信息 */
    user,
    /** JWT 令牌 */
    token,
    /** 是否正在加载 */
    isLoading: isLoading || userQuery.isLoading || loginMutation.isPending || registerMutation.isPending,
    /** 是否已登录 */
    isAuthenticated: !!token && !!user,
    /** 登录函数 */
    login: loginMutation.mutateAsync,
    /** 注册函数 */
    register: registerMutation.mutateAsync,
    /** 登出函数 */
    logout,
    /** 登录错误 */
    loginError: loginMutation.error?.message ?? null,
    /** 注册错误 */
    registerError: registerMutation.error?.message ?? null,
    /** 重新获取用户信息 */
    refetchUser: userQuery.refetch,
  }
}
