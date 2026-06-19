// 认证页路由外壳（pathless layout）
//
// 不影响 URL，仅为其下认证路由提供干净外壳，不带 Header/Footer/
// AnnouncementBar/SidebarWidgets。

import { createFileRoute, Outlet } from "@tanstack/react-router";

function AuthLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});
