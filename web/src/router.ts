// TanStack Router 装配
//
// 创建 router 实例，注入 context（queryClient），
// 供路由 loader / beforeLoad 访问。类型安全的路由树由
// routeTree.gen.ts（@tanstack/router-plugin 自动生成）提供。

import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { DefaultError, DefaultPending } from "./routes/__root";
import { routeTree } from "./routeTree.gen";

/** 应用级 router context：注入到所有路由的 loader / beforeLoad */
export interface RouterContext {
  /** TanStack Query 客户端，loader 用 ensureQueryData 预取 */
  queryClient: QueryClient;
}

/**
 * 创建 router 实例
 * @param queryClient 与 QueryProvider 共享的 QueryClient
 */
export function createRouter(queryClient: QueryClient) {
  return createTanstackRouter({
    routeTree,
    // hover 预取：鼠标悬停链接即触发 loader，实现零延迟跳转
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError,
    context: { queryClient },
  });
}

/** router 实例类型，供 useNavigate / Link 类型推导使用 */
export type AppRouter = ReturnType<typeof createRouter>;
