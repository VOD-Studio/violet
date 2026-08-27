import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /admin/series 布局路由（layout route）
 *
 * 仅作为 /admin/series（index 列表）与 /admin/series/$id（编辑）两者的
 * 父布局，自身不渲染内容，只透传 <Outlet/>（对齐 admin.posts 模式）。
 */
export const Route = createFileRoute("/admin/series")({
	component: SeriesLayout,
});

function SeriesLayout() {
	return <Outlet />;
}
