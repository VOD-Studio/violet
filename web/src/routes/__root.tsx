// 根路由（TanStack Start SSR）
//
// 2.0 SSR：用 createRootRouteWithContext 注入 queryClient 类型，
// RootDocument 渲染完整 HTML 壳（<html><head><body>）+ HeadContent/Scripts。
// 全局 Provider（ThemeProvider/QueryProvider/SettingsProvider/ToastProvider）
// 挂在 RootDocument 内，queryClient 取自 router context（与 loader 共享）。

import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools as RouterDevtools } from "@tanstack/router-devtools";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import { SettingsProvider } from "@/components/shared/SettingsProvider";
import { ToastProvider } from "@/components/shared/Toast";
import { Toaster } from "@/components/ui/sonner";
import type { RouterContext } from "@/router";
import "@/index.css";

/** 路由级加载占位符 */
export function DefaultPending() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}

/** 路由级错误兜底，提供重试与刷新按钮 */
export function DefaultError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
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

export const Route = createRootRouteWithContext<RouterContext>()({
  // SSR head：meta/links，替代 index.html
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Blog Project" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootComponent,
});

function RootComponent() {
  // 从 router context 取 queryClient（与 loader 共享同一实例）
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <QueryProvider client={queryClient}>
        {/* 主题：class 策略（在 <html> 加 .light/.dark），与 index.css 的 @custom-variant dark 一致 */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsProvider>
            <ToastProvider>
              <Outlet />
              <Toaster />
              {import.meta.env.DEV && (
                <RouterDevtools position="bottom-right" />
              )}
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </QueryProvider>
    </RootDocument>
  );
}

/**
 * SSR HTML 文档壳
 * 渲染完整的 <html>/<head>/<body>，注入 HeadContent（meta/links）与 Scripts（hydration）。
 */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
