import { authKeys } from "@features/auth/api/keys";
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import { notifySessionExpired, requestReplay, setReplayer } from "./auth-gate";
import { CSRF_HEADER, getCSRFToken } from "./csrf";
import { ApiError } from "./error";
import { clientQueryClient } from "./query-client";
import { triggerRefresh } from "./refresh-queue";
import { scheduleRefresh, setOnSessionExpired, setRefresher } from "./token-scheduler";
import type { Envelope, Pagination } from "./types";

// 让 axios 配置对象携带 __retried 标记，防止 401 自动 refresh 死循环。
// augment AxiosRequestConfig（而非 InternalAxiosRequestConfig），
// 因为 client.post 的第三参数是 AxiosRequestConfig，类型上不互通。
declare module "axios" {
    interface AxiosRequestConfig {
        __retried?: boolean;
        /**
         * 跳过 authGate（弹窗+挂起重放）的 401 处理。
         *
         * 用于「身份探活」类请求（getCurrentUser、useMe 的 fetchMe）：
         * 它们只需要一个干净的通过/失败信号来决定 UI 状态，
         * 不应触发登录弹窗或把请求挂起——否则登出后导航重跑 getCurrentUser
         * 会撞 401 → 弹窗 + beforeLoad 永久挂起。
         * 设为 true 时，401 走普通错误归一化直接 reject，由调用方 try/catch 兜底。
         */
        __skipAuthGate?: boolean;
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
        const method = config.method?.toLowerCase();
        if (method && method !== "get") {
            const existing = config.headers.get(CSRF_HEADER);
            if (!existing) {
                const token = getCSRFToken();
                if (token) {
                    config.headers.set(CSRF_HEADER, token);
                }
            }
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

            // 401 处理。两类请求需要跳过整个 refresh + authGate 流程：
            //   1. 主动认证请求（login/register/verify-email/logout 等）：401 是确定性
            //      业务结果，尝试 refresh 毫无意义（未登录必然 401），且会浪费一次请求。
            //   2. 身份探活请求（getCurrentUser/fetchMe）：只需要干净的通过/失败信号。
            // 这两类直接 fall through 到下方归一化抛 401，由调用方处理。
            //
            // 其余业务请求撞 401（token 过期）：触发 refresh（去重队列）后重放原请求一次。
            // __retried 标记防止 refresh 返回 401 时无限循环。
            if (
                status === 401 &&
                err.config &&
                !err.config.__retried &&
                !err.config.__skipAuthGate
            ) {
                const expiresIn = await triggerRefresh(async () => {
                    try {
                        const res = await client.post("/auth/refresh", {}, { __retried: true });
                        // 解包 envelope 拿 expires_in：成功响应已被 success interceptor
                        // 拆成 { data } 形态，data 即 TokenResponse
                        const data = (res.data as UnpackedResponse).data as
                            | { expires_in?: number }
                            | undefined;
                        return data?.expires_in ?? null;
                    } catch {
                        return null;
                    }
                });
                if (expiresIn) {
                    // 响应式 refresh 成功：用新 expires_in 重新 arm 主动刷新定时器
                    scheduleRefresh(expiresIn);
                    err.config.__retried = true;
                    return client.request(err.config);
                }
                // refresh 失败：交给 authGate 挂起原请求 + 弹出登录弹窗，
                // 用户重登成功后 flush() 用新 cookie 重放，取消则 rejectAll()。
                // SSR 端未注册 replayer，requestReplay 内部会直接抛 401 兜底。
                return requestReplay(err.config);
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
 *
 * 仅客户端单例向 authGate 注册 replayer：
 * refresh 失败后弹窗登录，重放请求复用此实例（带新 cookie）。
 * SSR 实例不注册，requestReplay 会直接抛 401 兜底（让 SSR 调用方处理）。
 */
export const httpClient = createHttpClient();
// 仅客户端注册 replayer：SSR 期间不应弹窗/挂起重放。
// 若在 SSR 也注册，getCurrentUser 的 /auth/me 401 → /auth/refresh 401 链路会
// 把原请求推入 authGate 挂起队列等待 flush()，而 SSR 永远不会 flush → 渲染死锁。
// SSR 不注册时，requestReplay 直接 reject(401)，由 getCurrentUser 的 try/catch 兜成 null。
if (typeof window !== "undefined") {
    setReplayer((config) => httpClient.request(config));
    // 主动刷新实现：定时器到期时调用，单飞复用 triggerRefresh 防并发。
    // 成功返回新 expires_in 供调度器重新 arm；失败返回 null（交由响应式兜底）。
    setRefresher(() =>
        triggerRefresh(async () => {
            try {
                const r = await httpClient.post("/auth/refresh", {}, { __retried: true });
                const data = (r.data as UnpackedResponse).data as
                    | { expires_in?: number }
                    | undefined;
                return data?.expires_in ?? null;
            } catch {
                return null;
            }
        }),
    );
    // 主动刷新失败降级：refresh token 也失效时，完整清理会话状态 + 弹登录窗。
    // 必须清 me 缓存：否则 useMe 在 me stale 后会 refetch /auth/me → 401，
    // 而 401 走 __skipAuthGate 不弹窗只 retry → 401 风暴。
    // notifySessionExpired 内部已 clearSessionActive（让 useMe.enabled 翻 false），
    // 此处再补 removeQueries 清掉陈旧 me 缓存，双重保险切断 401 链。
    setOnSessionExpired(() => {
        clientQueryClient.removeQueries({ queryKey: authKeys.me() });
        notifySessionExpired();
    });
}
