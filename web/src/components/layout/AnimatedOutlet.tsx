// 动画 Outlet 组件
// 替代 TanStack Router 的静态 <Outlet />，实现路由切换时的过渡动画
// 用 useRouterState 获取当前路径作 key，配合 AnimatePresence 管理进出动画
//
// 2.0 起：从 react-router (useOutlet + useLocation) 迁移到 TanStack Router。

import { Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { PageTransition } from "./PageTransition";

/**
 * 动画路由出口组件
 * 用法：在布局组件中用 <AnimatedOutlet /> 替代 <Outlet />
 * 路由切换时自动播放过渡动画
 */
export function AnimatedOutlet() {
  // 用 router state 选择当前 location pathname，避免不必要重渲染
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <AnimatePresence mode="wait">
      {/* 用 pathname 作 key，路径变化时触发退出/进入动画 */}
      <PageTransition key={pathname} pathname={pathname}>
        <Outlet />
      </PageTransition>
    </AnimatePresence>
  );
}
