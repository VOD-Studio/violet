// API 请求客户端
// 封装 fetch 请求，自动附加 JWT 认证令牌，统一处理错误和基础配置

/** API 基础地址，从环境变量读取，默认为本地开发地址 */
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"

/** API 响应的通用结构 */
interface ApiResponse<T = unknown> {
  /** 响应数据 */
  data: T
  /** 响应消息 */
  message?: string
}

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

/**
 * 从 localStorage 获取存储的 JWT 令牌
 * @returns JWT 令牌字符串，未登录时返回 null
 */
function getToken(): string | null {
  return localStorage.getItem("token")
}

/**
 * 发起 API 请求的核心函数
 * 自动附加 Authorization 头，处理 JSON 响应和错误
 *
 * @param endpoint - API 路径，例如 "/posts"
 * @param options - fetch 请求配置选项
 * @returns 解析后的响应数据
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()

  /** 构建请求头，包含内容类型和可选的认证令牌 */
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  }

  /* 如果存在令牌，附加到请求头 */
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  /* 处理 204 无内容响应 */
  if (response.status === 204) {
    return undefined as T
  }

  /** 解析响应 JSON */
  const result = await response.json()

  /* 请求失败时抛出 ApiError */
  if (!response.ok) {
    throw new ApiError(
      response.status,
      result.message ?? "请求失败",
      result.errors,
    )
  }

  return (result.data ?? result) as T
}

/**
 * GET 请求
 * @param endpoint - API 路径
 */
function get<T>(endpoint: string) {
  return request<T>(endpoint, { method: "GET" })
}

/**
 * POST 请求
 * @param endpoint - API 路径
 * @param body - 请求体数据
 */
function post<T>(endpoint: string, body?: unknown) {
  return request<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * PUT 请求
 * @param endpoint - API 路径
 * @param body - 请求体数据
 */
function put<T>(endpoint: string, body?: unknown) {
  return request<T>(endpoint, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * DELETE 请求
 * @param endpoint - API 路径
 */
function del<T>(endpoint: string) {
  return request<T>(endpoint, { method: "DELETE" })
}

/** 导出的 API 客户端对象 */
export const api = { get, post, put, del }

/** 导出 ApiError 供外部捕获特定错误 */
export { ApiError }
export type { ApiResponse }
