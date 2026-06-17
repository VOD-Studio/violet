// 前台布局路由（pathless layout）
//
// 不影响 URL（不带路径段），仅为其下路由提供 Layout 外壳（Header/Footer/
// AnnouncementBar/SidebarWidgets/AnimatedOutlet）。
//
// 2.0：Layout 内部组件（Header/AnimatedOutlet/Footer）已迁移到 TanStack Router，
// 接入无阻碍。Layout 通过 AnimatedOutlet 渲染子路由。

import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/layout/Layout";

function PublicLayout() {
  return <Layout />;
}

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});
