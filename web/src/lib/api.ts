// API 请求客户端
// 使用 axios 封装请求，自动附加 JWT 认证令牌，统一处理错误
// 支持自动刷新即将过期的 token
// token 状态统一由 zustand store 管理

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store";
import { getNavigate } from "@/lib/navigation";

/** API 基础地址 */
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

/** 服务器根地址，用于拼接静态资源 URL */
const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_ORIGIN ?? "http://localhost:8080";

/**
 * 获取上传文件的完整 URL
 * @param path - 后端返回的路径，可能是相对路径或完整 URL
 * @returns 完整的文件访问地址
 */
export function getUploadUrl(path: string): string {
  // 如果已经是完整 URL，直接返回
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // 如果路径不以 / 开头，添加前导斜杠
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SERVER_ORIGIN}${normalizedPath}`;
}

/** API 错误结构 */
class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/** 创建 axios 实例 */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/** 刷新 token 锁，防止并发刷新 */
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

/**
 * 检查 token 是否即将过期（5 分钟内）
 * 从 zustand store 读取过期时间
 */
function isTokenExpiring(): boolean {
  const { expiresAt } = useAuthStore.getState();
  if (!expiresAt) return false;
  // 提前 5 分钟刷新
  return expiresAt - Date.now() < 5 * 60 * 1000;
}

/**
 * 刷新 token
 * 刷新成功后更新 zustand store
 */
async function refreshToken(): Promise<string> {
  // 如果正在刷新，等待结果
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  isRefreshing = true;
  refreshPromise = axios
    .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then((res) => {
      const { access_token, refresh_token, expires_in, refresh_expires_in } =
        res.data;
      // 更新 zustand store
      useAuthStore
        .getState()
        .setAuth(access_token, refresh_token, expires_in, refresh_expires_in);
      isRefreshing = false;
      refreshPromise = null;
      return access_token;
    })
    .catch((err) => {
      isRefreshing = false;
      refreshPromise = null;
      // 刷新失败，清除认证状态
      useAuthStore.getState().clearAuth();
      throw err;
    });

  return refreshPromise;
}

/**
 * 请求拦截器
 * 自动附加 token，并在即将过期时刷新
 */
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 刷新接口本身不需要检查过期
    if (config.url === "/auth/refresh") {
      return config;
    }

    const { token, refreshToken: storedRefreshToken } = useAuthStore.getState();

    // 如果没有 token 但有 refreshToken，尝试刷新
    if (!token && storedRefreshToken) {
      try {
        const newToken = await refreshToken();
        config.headers.Authorization = `Bearer ${newToken}`;
      } catch {
        // 刷新失败，清除认证状态，不添加 Authorization header
        useAuthStore.getState().clearAuth();
      }
      return config;
    }

    if (!token) {
      return config;
    }

    // 检查是否即将过期，自动刷新
    if (isTokenExpiring()) {
      try {
        const newToken = await refreshToken();
        config.headers.Authorization = `Bearer ${newToken}`;
      } catch {
        // 刷新失败，使用旧 token 继续（可能会 401）
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // FormData 请求让浏览器自动设置 Content-Type
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 响应拦截器
 * 统一处理错误，401 状态码先尝试刷新 token 再跳转登录页
 */
client.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>,
  ) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response) {
      const { status, data } = error.response;

      /* 401 未授权：尝试刷新 token 后重试 */
      if (status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        const { refreshToken: refreshTokenValue } = useAuthStore.getState();
        if (refreshTokenValue) {
          try {
            const newToken = await refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            // 重试原请求
            return client(originalRequest);
          } catch {
            // 刷新失败，清除认证状态
            useAuthStore.getState().clearAuth();
          }
        } else {
          // 没有 refresh token，清除认证状态
          useAuthStore.getState().clearAuth();
        }

        const navigate = getNavigate();
        if (navigate && window.location.pathname !== "/login") {
          navigate("/login");
        }
      }

      throw new ApiError(status, data?.message ?? "请求失败", data?.errors);
    }

    /* 网络错误 */
    throw new ApiError(0, "网络连接失败，请检查网络状态");
  },
);

/** 导出的 API 客户端 */
export const api = {
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await client.get(endpoint, { params });
    return (response.data.data ?? response.data) as T;
  },

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.post(endpoint, body);
    return (response.data.data ?? response.data) as T;
  },

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.put(endpoint, body);
    return (response.data.data ?? response.data) as T;
  },

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await client.patch(endpoint, body);
    return (response.data.data ?? response.data) as T;
  },

  async del<T>(endpoint: string): Promise<T> {
    const response = await client.delete(endpoint);
    return (response.data.data ?? response.data) as T;
  },
};

export { ApiError };
