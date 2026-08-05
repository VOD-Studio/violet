import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * /admin/posts 布局路由（layout route）
 *
 * 仅作为 /admin/posts（index 列表）、/admin/posts/new（新建）、
 * /admin/posts/$id（编辑）三者的父布局，自身不渲染内容，只透传 <Outlet/>。
 *
 * 列表页用 PageShell（标准 admin 布局），编辑器页是全屏沉浸式布局，
 * 二者布局差异大，故不在此共享布局，各自由组件内部决定。
 */
export const Route = createFileRoute("/admin/posts")({
	component: PostsLayout,
});

function PostsLayout() {
	return <Outlet />;
}
