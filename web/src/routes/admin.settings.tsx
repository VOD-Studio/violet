import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * /admin/settings 布局路由（layout route）
 *
 * 站点设置已按职责拆为多个子页（基础信息 / 认证 / GitHub / 关于 / LLM / 代码运行器），
 * 本路由仅作父布局，自身不渲染内容，透传 <Outlet/>。
 *
 * 直接访问 /admin/settings 时重定向到首个子页「基础信息」，避免空白 Outlet。
 * 对齐 admin.posts.tsx 的父布局先例。
 */
export const Route = createFileRoute("/admin/settings")({
	beforeLoad: ({ location }) => {
		// 仅在精确访问 /admin/settings（无子路径）时重定向到首个子页，
		// 避免无条件 redirect 导致访问任意子页时父路由 beforeLoad 反复触发形成死循环。
		if (location.pathname === "/admin/settings") {
			throw redirect({ to: "/admin/settings/general", replace: true });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	return <Outlet />;
}
