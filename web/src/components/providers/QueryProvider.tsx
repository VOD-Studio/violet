// React Query 全局提供者组件
// 封装 QueryClientProvider，配置默认查询选项

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

/** QueryProvider 组件属性 */
interface QueryProviderProps {
  children: React.ReactNode
}

/**
 * 创建 QueryClient 实例的工厂函数
 * 使用函数形式确保 SSR 安全（每个请求独立实例）
 */
function makeQueryClient() {
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
  })
}

/**
 * React Query 全局提供者
 * 在应用顶层包裹，提供查询客户端和开发工具
 */
export default function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
