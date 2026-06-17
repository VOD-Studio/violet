// 前台布局路由（pathless layout）
//
// 不影响 URL（不带路径段），仅为其下路由提供 Layout 外壳。
// 对应原 react-router 的 <Route element={<Layout />}>。
//
// 注意：2.0 重构期，旧 Layout 组件（Header/AnimatedOutlet/Footer）仍依赖
// react-router，故此处暂用一个简化的外壳，待 Phase 4 视觉重设计时一并迁移
// Layout 内部组件到 TanStack Router。

import { createFileRoute, Outlet } from "@tanstack/react-router";

function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});
