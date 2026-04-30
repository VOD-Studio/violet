// API 请求客户端
// 使用 axios 封装请求，自动附加 JWT 认证令牌，统一处理错误

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

/** API 基础地址，从环境变量读取，默认为本地开发地址 */
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api"

/** API 错误结构 */
class ApiError extends Error {
  /** HTTP 状态码 */
  status: number
  /** 错误详情 */
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.errors = errors
  }
}

/** 创建 axios 实例 */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * 请求拦截器
 * 自动从 localStorage 读取 JWT 令牌并附加到请求头
 * FormData 请求自动移除 Content-Type，让浏览器自动设置 boundary
 */
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // FormData 请求需要浏览器自动设置 Content-Type（包含 boundary）
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"]
    }
    return config
  },
  (error) => Promise.reject(error),
)

/**
 * 响应拦截器
 * 统一处理错误，401 状态码自动跳转登录页
 */
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    if (error.response) {
      const { status, data } = error.response

      /* 401 未授权：清除本地令牌并跳转登录页 */
      if (status === 401) {
        localStorage.removeItem("token")
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
      }

      throw new ApiError(
        status,
        data?.message ?? "请求失败",
        data?.errors,
      )
    }

    /* 网络错误或其他无法响应的情况 */
    throw new ApiError(0, "网络连接失败，请检查网络状态")
  },
)

/** 导出的 API 客户端对象 */
export const api = {
  /**
   * GET 请求
   * @param endpoint - API 路径
   * @param params - 查询参数
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await client.get(endpoint, { params })
    return (response.data.data ?? response.data) as T
  },

  /**
   * POST 请求
   * @param endpoint - API 路径
   * @param body - 请求体数据
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.post(endpoint, body)
    return (response.data.data ?? response.data) as T
  },

  /**
   * PUT 请求
   * @param endpoint - API 路径
   * @param body - 请求体数据
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.put(endpoint, body)
    return (response.data.data ?? response.data) as T
  },

  /**
   * PATCH 请求
   * @param endpoint - API 路径
   * @param body - 请求体数据
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.patch(endpoint, body)
    return (response.data.data ?? response.data) as T
  },

  /**
   * DELETE 请求
   * @param endpoint - API 路径
   */
  async del<T>(endpoint: string): Promise<T> {
    const response = await client.delete(endpoint)
    return (response.data.data ?? response.data) as T
  },
}

/** 导出 ApiError 供外部捕获特定错误 */
export { ApiError }
