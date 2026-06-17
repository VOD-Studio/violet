// 全局导航管理
// 用于在 React 组件外部（如 axios 拦截器）执行路由跳转。
// 不使用 window.location.href 以避免页面刷新导致 network 日志丢失。
//
// 2.0 起：从 react-router 的 useNavigate 注入模式改为直接持有 TanStack router
// 实例，调用 router.navigate({ to })（对象式、类型安全）。

import type { AppRouter } from "@/router";

/** 全局 router 实例引用（在 main.tsx 创建 router 后注入） */
let router: AppRouter | null = null;

/**
 * 注入全局 router 实例
 * 在 main.tsx 创建 router 后调用一次。
 */
export function setRouter(r: AppRouter) {
  router = r;
}

/**
 * 获取全局 router 实例
 * 用于非 React 组件中执行路由跳转（如 axios 401 拦截）。
 */
export function getRouter(): AppRouter | null {
  return router;
}

/**
 * 在组件外执行路由跳转（便捷封装）
 * @param to 目标路径（需为已注册路由，类型由 router 约束）
 */
export function navigate(to: "/login"): void;
export function navigate<T extends string>(to: T): void;
export function navigate(to: string): void {
  router?.navigate({ to });
}
