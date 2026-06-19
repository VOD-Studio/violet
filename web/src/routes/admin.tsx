// 后台布局路由 (/admin)
//
// 守卫：检查认证 + admin:access 权限，未通过跳转 /login。
// 替代原 react-router 的 <ProtectedAdmin> 渲染式守卫 + <Navigate>。
//
// 2.0 重构期：旧 AdminLayout 组件（含 react-router Outlet）暂不接入，
// 用简化外壳；Phase 4 视觉重设计时一并迁移后台布局（含移动端 Drawer 化）。

import { createFileRoute, redirect } from "@tanstack/react-router";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthStore } from "@/store";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    const { token, expiresAt, user } = useAuthStore.getState();
    const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
    const hasAdminAccess = user?.permissions?.includes("admin:access");
    if (!isAuthenticated || !hasAdminAccess) {
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
});
