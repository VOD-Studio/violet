import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import { CSRF_HEADER, getCSRFToken } from "./csrf";
import { ApiError } from "./error";
import { triggerRefresh } from "./refresh-queue";
import type { Envelope, Pagination } from "./types";

// 让 axios 配置对象携带 __retried 标记，防止 401 自动 refresh 死循环。
// augment AxiosRequestConfig（而非 InternalAxiosRequestConfig），
// 因为 client.post 的第三参数是 AxiosRequestConfig，类型上不互通。
declare module "axios" {
	interface AxiosRequestConfig {
		__retried?: boolean;
	}
}

/**
 * HttpClientOptions - createHttpClient 的参数
 */
export interface HttpClientOptions {
	/** 覆盖默认 baseURL；SSR 必须传绝对 URL */
	baseURL?: string;
	/**
	 * SSR 转发入口请求的 cookie header
	 * Node server 是长驻进程，必须每请求独立实例并注入对应 cookie，
	 * 避免跨请求 cookie 串扰（A 请求的 cookie 注入到 B 请求）。
	 */
	forwardedCookie?: string;
}

/**
 * UnpackedResponse - httpClient 解包后的成功响应形态
 *
 * 后端 envelope `{ data, meta.pagination }` 在 response interceptor 中
 * 被拆成此结构，业务层直接拿 data 与 pagination，无需感知 envelope。
 *
 * 注意：axios 调用泛型应针对 T（业务数据类型），而不是 Envelope<T>。
 *
 * @typeParam T - 业务数据类型
 */
export interface UnpackedResponse<T = unknown> {
	/** 业务数据 */
	data: T;
	/** 分页元数据（仅列表接口存在） */
	pagination?: Pagination;
}

/**
 * getBaseUrl - 根据 SSR/客户端环境返回 axios baseURL
 *
 * - 客户端：相对 /api/v1，由反向代理转发到后端（同源，cookie 自动携带）
 * - 服务端：从 VITE_SSR_API_BASE_URL 读内网地址（绕过反代，直连后端容器）
 */
const getBaseUrl = (): string => {
	if (typeof window === "undefined") {
		return import.meta.env.VITE_SSR_API_BASE_URL || "http://localhost:8080/api/v1";
	}
	return import.meta.env.VITE_API_BASE_URL || "/api/v1";
};

/**
 * createHttpClient - 创建配好 interceptors 的 axios 实例
 *
 * 装配职责（按执行顺序）：
 * 1. withCredentials: true（跨域携带 access/refresh/csrf cookie）
 * 2. axiosRetry：仅 ERR_NETWORK/ETIMEDOUT/5xx 重试 2 次，业务 4xx 不重试
 * 3. request interceptor：写请求自动注入 X-CSRF-Token header
 * 4. response success interceptor：拆 envelope 成 UnpackedResponse
 * 5. response error interceptor：401 自动 refresh（去重队列）→ 归一化为 ApiError
 *
 * @param opts SSR 时传 forwardedCookie；客户端默认不传
 * @returns 配好的 axios 实例
 */
export const createHttpClient = (opts: HttpClientOptions = {}): AxiosInstance => {
	const client = axios.create({
		baseURL: opts.baseURL || getBaseUrl(),
		timeout: 15000,
		withCredentials: true,
	});

	if (opts.forwardedCookie) {
		client.defaults.headers.common.Cookie = opts.forwardedCookie;
	}

	axiosRetry(client, {
		retries: 2,
		retryCondition: (err: AxiosError) => {
			// 仅网络错误或服务端错误重试；业务 4xx 重试无意义且可能放大问题
			if (err.code === "ERR_NETWORK" || err.code === "ETIMEDOUT") return true;
			const status = err.response?.status ?? 0;
			return status >= 500;
		},
		retryDelay: axiosRetry.exponentialDelay,
	});

	// 写请求自动注入 CSRF token（配合后端 double-submit 校验）
	client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
		const token = getCSRFToken();
		const method = config.method?.toLowerCase();
		if (token && method && method !== "get") {
			config.headers.set(CSRF_HEADER, token);
		}
		return config;
	});

	// 成功响应：拆 envelope，业务层不感知 { data, meta } 结构
	client.interceptors.response.use(
		(response) => {
			const env = response.data as Envelope;
			const unpacked: UnpackedResponse = {
				data: env.data,
				pagination: env.meta?.pagination,
			};
			response.data = unpacked;
			return response;
		},
		async (err: AxiosError) => {
			const status = err.response?.status ?? 0;

			// 401：触发 refresh（去重队列）后重放原请求一次
			// __retried 标记防止 refresh 返回 401 时无限循环
			if (status === 401 && err.config && !err.config.__retried) {
				const ok = await triggerRefresh(async () => {
					try {
						await client.post("/auth/refresh", {}, { __retried: true });
						return true;
					} catch {
						return false;
					}
				});
				if (ok) {
					err.config.__retried = true;
					return client.request(err.config);
				}
			}

			// 归一化错误：把后端错误结构（不在 data 下）转成 ApiError 抛出
			const body = err.response?.data as
				| (Envelope & {
						error?: string;
						message?: string;
						details?: Record<string, string[]>;
						request_id?: string;
				  })
				| undefined;

			if (body?.error) {
				throw new ApiError({
					error: body.error,
					message: body.message ?? "请求失败",
					status,
					details: body.details,
					requestId: body.request_id,
				});
			}

			if (err.code === "ERR_NETWORK" || err.code === "ETIMEDOUT") {
				throw ApiError.network();
			}

			throw new ApiError({
				error: "UNKNOWN",
				message: err.message || "未知错误",
				status,
			});
		},
	);

	return client;
};

/**
 * httpClient - 客户端单例
 *
 * 客户端全局共享，浏览器自动管理 cookie，无跨请求串扰问题。
 * SSR 不使用此变量——每请求通过 createHttpClient({ forwardedCookie }) 独立创建。
 */
export const httpClient = createHttpClient();
