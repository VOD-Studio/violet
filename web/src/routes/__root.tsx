// 根路由
// 承载全局 Provider 栈、默认 pending/error 组件、TanStack Router DevTools
//
// 2.0 起：路由从 react-router 迁移到 @tanstack/react-router（文件路由 + 代码生成）。
// 全局 Provider（站点设置、Toast）挂在此处的 component，QueryClient 通过 router
// context 注入（见 src/router.ts），不在 JSX 层嵌套。

import type { ErrorComponentProps } from "@tanstack/react-router";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools as RouterDevtools } from "@tanstack/router-devtools";
import { SettingsProvider } from "@/components/shared/SettingsProvider";
import { ToastProvider } from "@/components/shared/Toast";
import { Toaster } from "@/components/ui/sonner";

/** 路由级加载占位符 */
export function DefaultPending() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}

/** 路由级错误兜底，提供重试与刷新按钮 */
export function DefaultError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">页面出错了</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "发生未知错误，请稍后重试。"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        重试
      </button>
    </div>
  );
}

/**
 * 根路由组件
 * 全局 Provider + Outlet + DevTools（生产环境自动剔除）
 */
function RootComponent() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <Outlet />
        <Toaster />
        {/* TanStack Router DevTools：仅开发环境生效，生产构建自动移除 */}
        {import.meta.env.DEV && <RouterDevtools position="bottom-right" />}
      </ToastProvider>
    </SettingsProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  // 注：全局 pending/error 兜底由 createRouter 的 defaultPendingComponent /
  // defaultErrorComponent 提供（见 src/router.ts），根路由本身不支持这两个选项。
});
