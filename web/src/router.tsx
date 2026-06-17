// TanStack Start 路由装配
//
// 2.0 SSR：迁移到 TanStack Start。Start 插件自动接管 SSR 渲染管线，
// 本文件导出无参 getRouter() 工厂，内部创建 QueryClient 并通过
// setupRouterSsrQueryIntegration 自动处理 hydration/dehydration。
//
// 类型安全的路由树由 routeTree.gen.ts（router-plugin 自动生成）提供。

import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { makeQueryClient } from "@/components/providers/QueryProvider";
import { DefaultError, DefaultPending } from "./routes/__root";
import { routeTree } from "./routeTree.gen";

/** 应用级 router context：注入到所有路由的 loader / beforeLoad */
export interface RouterContext {
  /** TanStack Query 客户端，loader 用 ensureQueryData 预取 */
  queryClient: ReturnType<typeof makeQueryClient>;
}

/**
 * 创建 router 实例（Start 在每个请求调用，SSR 安全）
 * 内部创建 QueryClient 并接入 SSR query 集成（自动水合/脱水）。
 */
export function getRouter() {
  const queryClient = makeQueryClient();

  const router = createRouter({
    routeTree,
    // hover 预取：鼠标悬停链接即触发 loader，实现零延迟跳转
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError,
    context: { queryClient },
  });

  // TanStack Router + Query SSR 集成：自动处理服务端预取数据的序列化
  // 与客户端水合，无需手写 dehydrate()/Hydrate
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

/** router 实例类型，供 useNavigate / Link 类型推导使用 */
export type AppRouter = ReturnType<typeof getRouter>;

// 类型注册：让所有路由文件中获得类型化的 useNavigate / Link 等
declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
