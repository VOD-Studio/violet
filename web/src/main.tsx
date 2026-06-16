/**
 * 应用入口文件
 * 挂载根组件到 DOM 节点，配置 React Query + 主题 + TanStack Router
 *
 * 2.0 起：路由从 react-router 迁移到 @tanstack/react-router。
 * QueryClient 单例同时注入 router context（loader 用）和 QueryProvider（组件用），
 * 二者共享缓存。
 */

import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QueryProvider, {
  makeQueryClient,
} from "@/components/providers/QueryProvider";
import { setRouter } from "@/lib/navigation";
import { createRouter } from "@/router";
import "@/index.css";

// 共享 QueryClient 单例：router context 与 QueryProvider 共用
const queryClient = makeQueryClient();
// router 实例（注入 queryClient 到 context，供 loader / beforeLoad 使用）
const router = createRouter(queryClient);
// 注入到全局 navigation，供 axios 拦截器等非组件代码跳转
setRouter(router);

// 类型注册：让所有路由文件中获得类型化的 useNavigate / Link 等
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryProvider client={queryClient}>
      {/* 主题：class 策略（在 <html> 加 .light/.dark），与 index.css 的 @custom-variant dark 一致 */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);
