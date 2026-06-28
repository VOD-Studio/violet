import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./error";

/**
 * createQueryClient - 创建配置好的 QueryClient
 *
 * 默认配置遵循项目数据访问约定：
 * - staleTime 60s：避免短时间重复请求
 * - 业务 4xx 错误不重试（重试无意义）
 * - 网络错误/5xx 最多重试 2 次
 * - 关闭窗口聚焦自动刷新（避免无谓请求）
 *
 * SSR 时每个请求必须独立创建（避免跨请求缓存串扰），
 * 客户端可复用单例（见 app/provider.tsx）。
 *
 * @returns 配好默认 options 的 QueryClient
 */
export const createQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60_000,
                retry: (failureCount, err) => {
                    // 业务错误（4xx）不重试
                    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
                        return false;
                    }
                    return failureCount < 2;
                },
                refetchOnWindowFocus: false,
            },
            mutations: {
                retry: false,
            },
        },
    });

/**
 * clientQueryClient - 客户端 QueryClient 单例
 *
 * 供 QueryClientProvider（所有 useQuery/useMutation 订阅）与非组件层代码
 * （如 http 拦截器清 me 缓存）共用同一实例。
 *
 * 仅客户端有效：SSR 端每请求由 router context 独立创建实例（避免跨请求缓存串扰），
 * 不使用此单例。非组件代码（http.ts 的 onSessionExpired）也只在客户端注册，
 * 故读取此单例安全。
 */
export const clientQueryClient = createQueryClient();
