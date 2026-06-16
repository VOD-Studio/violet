// React Query 全局提供者组件
// 封装 QueryClientProvider，配置默认查询选项
//
// 2.0 起：导出 makeQueryClient 供 TanStack Router context 复用同一实例，
// 使路由 loader 的 ensureQueryData 与组件 useQuery 共享缓存。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** QueryProvider 组件属性 */
interface QueryProviderProps {
  children: React.ReactNode;
  /** 外部传入的 QueryClient（与 TanStack Router 共享同一实例时使用） */
  client?: QueryClient;
}

/**
 * 创建 QueryClient 实例的工厂函数
 * 使用函数形式确保 SSR 安全（每个请求独立实例）
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /** 数据过期时间：5 分钟内认为数据是新鲜的 */
        staleTime: 5 * 60 * 1000,
        /** 请求失败后重试次数 */
        retry: 1,
        /** 窗口重新获得焦点时不自动重新请求 */
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * React Query 全局提供者
 * 在应用顶层包裹，提供查询客户端
 */
export default function QueryProvider({
  children,
  client,
}: QueryProviderProps) {
  return (
    <QueryClientProvider client={client ?? makeQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
