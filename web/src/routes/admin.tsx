import { AdminSidebar } from "@features/admin-layout/ui/AdminSidebar";
import { AdminTopBar } from "@features/admin-layout/ui/AdminTopBar";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
});

/** 根据当前路由路径解析 TopBar 标题 */
function useAdminTitle(): string {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	if (pathname === "/admin") return "概览";
	if (pathname.startsWith("/admin/users")) return "用户管理";
	if (pathname.startsWith("/admin/emojis")) return "表情管理";
	return "后台管理";
}

/**
 * /admin - 后台布局
 *
 * 桌面侧边栏（AdminSidebar）+ 移动抽屉（AdminMobileNav 内嵌于 TopBar）
 * + 顶栏（AdminTopBar）+ 内容区（Outlet）。全部语义色 token，随主题切换。
 * 子页面共用 PageShell 渲染标题与内容壳。
 */
function AdminLayout() {
	const title = useAdminTitle();

	return (
		<div className="bg-background flex h-screen w-full">
			<AdminSidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<AdminTopBar title={title} />
				<main className="flex-1 overflow-auto p-4 md:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
